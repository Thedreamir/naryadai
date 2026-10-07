-- Staged only. Rate bucket is a salted server-side IP hash, never a raw IP.
create table if not exists public.pin_rate_buckets(bucket text primary key,window_start timestamptz not null,count integer not null);
alter table public.pin_rate_buckets enable row level security;
create or replace function public.pin_login_gate(p_email text,p_pin text,p_bucket text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare e employees%rowtype;a pin_attempts%rowtype;b pin_rate_buckets%rowtype;t timestamptz:=clock_timestamp();n int;
begin
 if p_bucket !~ '^[a-f0-9]{64}$' or p_pin !~ '^\d{4,6}$' or length(p_email)>254 then return jsonb_build_object('status','invalid');end if;
 insert into pin_rate_buckets values(p_bucket,t,0) on conflict do nothing;
 select * into b from pin_rate_buckets where bucket=p_bucket for update;
 if b.window_start<=t-interval '10 minutes' then b.window_start:=t;b.count:=0;end if;
 b.count:=b.count+1;update pin_rate_buckets set window_start=b.window_start,count=b.count where bucket=p_bucket;
 if b.count>20 then return jsonb_build_object('status','locked');end if;
 select * into e from employees where lower(email)=lower(trim(p_email)) and is_active for update;
 if not found or e.pin_hash is null then return jsonb_build_object('status','denied');end if;
 insert into pin_attempts(employee_id) values(e.id) on conflict do nothing;
 select * into a from pin_attempts where employee_id=e.id for update;
 if a.locked_until>t then return jsonb_build_object('status','locked');end if;
 if a.locked_until is not null then a.failures:=0;end if;
 if crypt(p_pin,e.pin_hash)=e.pin_hash then
 update pin_attempts set failures=0,locked_until=null where employee_id=e.id;
 return jsonb_build_object('status','ok','employee_id',e.id);
 end if;
 n:=a.failures+1;
 update pin_attempts set failures=n,locked_until=case when n>=5 then t+interval '10 minutes' else null end where employee_id=e.id;
 return jsonb_build_object('status',case when n>=5 then 'locked' else 'denied' end);
end $$;
revoke all on function public.pin_login_gate(text,text,text) from public,anon,authenticated;
grant execute on function public.pin_login_gate(text,text,text) to service_role;
select pg_notify('pgrst','reload schema');
