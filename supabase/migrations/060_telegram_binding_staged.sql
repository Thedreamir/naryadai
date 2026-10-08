-- STAGED ONLY. Read-before-write, exact rollback, full-role tests before production.
-- Deep link is a pairing request, not permission to see Tekton data.
begin;
create table public.telegram_pair_requests(id uuid primary key default gen_random_uuid(),employee_id uuid not null references employees(id),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),expires_at timestamptz not null check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),consumed_at timestamptz,pending_chat text,pending_telegram text,confirmed_at timestamptz,revoked_at timestamptz);
create table public.telegram_connections(employee_id uuid primary key references employees(id),chat_id text not null unique check(chat_id ~ '^[1-9][0-9]{0,15}$'),telegram_id text not null unique check(telegram_id=chat_id),confirmed_at timestamptz not null default now(),revoked_at timestamptz);
create table public.telegram_updates(update_id bigint primary key,received_at timestamptz not null default now());
create table public.telegram_deliveries(notification_id bigint not null references notifications(id),employee_id uuid not null references employees(id),state text not null check(state in ('claimed','sent','failed','unknown','cancelled')),claimed_at timestamptz not null default now(),finished_at timestamptz,message_id text,primary key(notification_id,employee_id));
alter table telegram_pair_requests enable row level security;
alter table telegram_connections enable row level security;
alter table telegram_updates enable row level security;
alter table telegram_deliveries enable row level security;
revoke all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries from anon,authenticated;
grant all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries to service_role;
create or replace function public.telegram_pair_create(p_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_actor(); rid uuid;
begin
 if coalesce(current_actor_role(),'') not in ('worker','master','leader','admin') or actor is null then raise exception 'actor required';end if;
 update telegram_pair_requests set revoked_at=now() where employee_id=actor and confirmed_at is null and revoked_at is null;
 insert into telegram_pair_requests(employee_id,token_hash,expires_at) values(actor,p_hash,now()+interval '10 minutes') returning id into rid;
 return jsonb_build_object('id',rid,'expires_at',now()+interval '10 minutes');
end $$;
create or replace function public.telegram_pending_bind(p_hash text,p_chat text,p_telegram text,p_update bigint) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
 if p_chat<>p_telegram or p_chat!~'^[1-9][0-9]{0,15}$' then return false;end if;
 insert into telegram_updates(update_id) values(p_update) on conflict do nothing;
 get diagnostics changed=row_count;if changed=0 then return false;end if;
 update telegram_pair_requests r set consumed_at=now(),pending_chat=p_chat,pending_telegram=p_telegram
 where token_hash=p_hash and expires_at>now() and consumed_at is null and revoked_at is null
 and exists(select 1 from employees e where e.id=r.employee_id and e.is_active and e.role in ('worker','master','leader','admin'));
 get diagnostics changed=row_count;return changed=1;
end $$;
create or replace function public.telegram_pair_status() returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('id',id,'pending_chat',pending_chat,'expires_at',expires_at,'confirmed',confirmed_at is not null) from telegram_pair_requests where employee_id=current_actor() and revoked_at is null and expires_at>now() order by created_at desc limit 1),'{}'::jsonb)
$$;
create or replace function public.telegram_pair_confirm(p_id uuid,p_expected_chat text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r telegram_pair_requests;
begin
 if coalesce(current_actor_role(),'') not in ('worker','master','leader','admin') then raise exception 'actor required';end if;
 select * into r from telegram_pair_requests where id=p_id and employee_id=current_actor() and expires_at>now() and consumed_at is not null and revoked_at is null and confirmed_at is null and pending_chat=p_expected_chat for update;
 if r.id is null then return false;end if;
 insert into telegram_connections(employee_id,chat_id,telegram_id) values(r.employee_id,r.pending_chat,r.pending_telegram)
 on conflict(employee_id) do update set chat_id=excluded.chat_id,telegram_id=excluded.telegram_id,confirmed_at=now(),revoked_at=null;
 update telegram_pair_requests set confirmed_at=now() where id=r.id;return true;
end $$;
create or replace function public.telegram_disconnect() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin update telegram_connections set revoked_at=now() where employee_id=current_actor();update telegram_pair_requests set revoked_at=now() where employee_id=current_actor() and revoked_at is null;end $$;
revoke all on function telegram_pair_create(text),telegram_pair_status(),telegram_pair_confirm(uuid,text),telegram_disconnect(),telegram_pending_bind(text,text,text,bigint) from public,anon,authenticated;
grant execute on function telegram_pair_create(text),telegram_pair_status(),telegram_pair_confirm(uuid,text),telegram_disconnect() to authenticated;
grant execute on function telegram_pending_bind(text,text,text,bigint) to service_role;
commit;
