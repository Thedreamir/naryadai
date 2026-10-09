-- L10 STAGED ONLY. No hooks, cron, network, backfill or existing dispatcher changes.
-- Rename to next unused migration only after reviewing the merged branch/live schema.
begin;
create table public.notification_jobs (
 id bigint generated always as identity primary key,
 notification_id bigint not null references public.notifications(id),
 channel text not null check(channel in ('telegram','push')),
 -- Binding/subscription version must be an opaque server identifier, never a chat ID/token.
 destination_key text not null check(length(destination_key) between 1 and 200),
 state text not null default 'pending' check(state in ('pending','leased','sending','sent','dead','unknown','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 available_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, provider_message_id text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(notification_id,channel,destination_key)
);
create index notification_jobs_ready_idx on notification_jobs(available_at,id) where state='pending';
create table public.notification_job_events (
 id bigint generated always as identity primary key,
 job_id bigint not null references notification_jobs(id),
 state text not null, attempt integer not null,
 reason_code text not null check(reason_code in ('enqueued','claimed','send_started','sent','transient_rejected','preflight_failed','permanent_rejected','uncertain','lease_expired','max_attempts','cancelled')),
 created_at timestamptz not null default now()
);
alter table notification_jobs enable row level security;
alter table notification_job_events enable row level security;
revoke all on notification_jobs,notification_job_events from public,anon,authenticated;
-- Service calls functions, not raw writes. A raw state change could bypass the lease fence.
revoke insert,update,delete,truncate,references,trigger on notification_jobs,notification_job_events from service_role;
grant select on notification_jobs,notification_job_events to service_role;

create function public.notification_enqueue(p_notification bigint,p_channel text,p_destination text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare jid bigint;
begin
 insert into notification_jobs(notification_id,channel,destination_key)
 values(p_notification,p_channel,p_destination) on conflict do nothing returning id into jid;
 if jid is not null then
  insert into notification_job_events(job_id,state,attempt,reason_code) values(jid,'pending',0,'enqueued');
 else
  select id into jid from notification_jobs where notification_id=p_notification and channel=p_channel and destination_key=p_destination;
 end if;
 return jid;
end $$;

create function public.notification_claim(p_limit integer default 20)
returns setof notification_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare j notification_jobs;
begin
 if p_limit<1 or p_limit>100 or p_limit is null then raise exception 'invalid batch limit'; end if;
 -- A stale preflight lease is safe to retry. A stale sending lease is uncertain, never retried.
 for j in select * from notification_jobs where state in ('leased','sending') and lease_until<=now() for update skip locked loop
  update notification_jobs set state=case when j.state='sending' then 'unknown' when j.attempts>=5 then 'dead' else 'pending' end,
   lease_token=null,lease_until=null,available_at=now(),updated_at=now() where id=j.id returning * into j;
  insert into notification_job_events(job_id,state,attempt,reason_code) values(j.id,j.state,j.attempts,'lease_expired');
 end loop;
 for j in select * from notification_jobs where state='pending' and available_at<=now() and attempts<5
  order by available_at,id for update skip locked limit p_limit loop
  update notification_jobs set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
   where id=j.id returning * into j;
  insert into notification_job_events(job_id,state,attempt,reason_code) values(j.id,j.state,j.attempts,'claimed');
  return next j;
 end loop;
end $$;

create function public.notification_begin_send(p_id bigint,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare j notification_jobs;
begin
 -- Worker MUST recheck current order, employee, binding/version and recipient before this call.
 update notification_jobs set state='sending',updated_at=now()
 where id=p_id and state='leased' and lease_token=p_token and lease_until>now() returning * into j;
 if j.id is null then return false;end if;
 insert into notification_job_events(job_id,state,attempt,reason_code) values(j.id,j.state,j.attempts,'send_started');
 return true;
end $$;

create function public.notification_finish(p_id bigint,p_token uuid,p_outcome text,p_retry_after integer default null,p_message text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare j notification_jobs; target text; delay_seconds integer;
begin
 if p_outcome is null or p_outcome not in ('sent','transient_rejected','preflight_failed','permanent_rejected','uncertain','cancelled') then raise exception 'invalid outcome';end if;
 select * into j from notification_jobs where id=p_id and lease_token=p_token and state in ('leased','sending') and lease_until>now() for update;
 if j.id is null then return false;end if;
 if (p_outcome='preflight_failed' and j.state<>'leased') or
    (p_outcome in ('sent','transient_rejected','permanent_rejected','uncertain') and j.state<>'sending') then raise exception 'outcome incompatible with send phase';end if;
 target:=case when p_outcome='sent' then 'sent' when p_outcome='cancelled' then 'cancelled' when p_outcome='uncertain' then 'unknown'
  when coalesce(p_retry_after,0)>86400 then 'unknown' when p_outcome='permanent_rejected' or j.attempts>=5 then 'dead' else 'pending' end;
 -- Provider retry-after is a minimum, bounded to one day. Never retry transport timeouts.
 delay_seconds:=least(86400,greatest(30*(2^(j.attempts-1))::integer,coalesce(p_retry_after,0)));
 update notification_jobs set state=target,available_at=now()+make_interval(secs=>delay_seconds),
  lease_token=null,lease_until=null,provider_message_id=case when target='sent' then left(p_message,200) else null end,updated_at=now() where id=j.id;
 insert into notification_job_events(job_id,state,attempt,reason_code) values(j.id,target,j.attempts,p_outcome);
 return true;
end $$;
revoke all on function notification_enqueue(bigint,text,text),notification_claim(integer),notification_begin_send(bigint,uuid),notification_finish(bigint,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function notification_enqueue(bigint,text,text),notification_claim(integer),notification_begin_send(bigint,uuid),notification_finish(bigint,uuid,text,integer,text) to service_role;
commit;
