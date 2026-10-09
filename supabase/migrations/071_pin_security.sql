-- LOCAL CANDIDATE. Worker-only PINs; privileged roles use password/OTP.
begin;
create table if not exists public.pin_management_audit(id bigint generated always as identity primary key,actor_id uuid not null,target_id uuid not null,action text not null,created_at timestamptz not null default clock_timestamp());
alter table public.pin_management_audit enable row level security;
revoke all on public.pin_management_audit from public,anon,authenticated,naryad_app;
create or replace function public.set_employee_pin(p_employee uuid,p_pin text) returns void language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare caller_role text;target_role text;
begin
 caller_role:=current_actor_role();
 if auth.uid() is null or caller_role is null or caller_role not in ('master','admin') then raise exception 'master or admin required';end if;
 if p_pin is null or p_pin !~ '^\d{6}$' then raise exception 'pin must be 6 digits';end if;
 select role into target_role from employees where id=p_employee and is_active for update;
 if not found then raise exception 'active employee required';end if;
 if caller_role='master' and target_role <> 'worker' then raise exception 'master may manage worker PIN only';end if;
 if target_role <> 'worker' then raise exception 'PIN login is worker only';end if;
 update employees set pin_hash=crypt(p_pin,gen_salt('bf')) where id=p_employee;
 insert into pin_management_audit(actor_id,target_id,action) values(auth.uid(),p_employee,'pin_set');
end $$;
revoke all on function public.set_employee_pin(uuid,text) from public,anon;
grant execute on function public.set_employee_pin(uuid,text) to authenticated;
create or replace function public.pin_login_gate(p_email text,p_pin text,p_bucket text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare e employees%rowtype;a pin_attempts%rowtype;b pin_rate_buckets%rowtype;t timestamptz:=clock_timestamp();n int;account_bucket text;
begin
 if p_bucket is null or p_email is null or p_pin is null or p_bucket !~ '^[a-f0-9]{64}$' or p_pin !~ '^\d{6}$' or length(p_email)>254 then return jsonb_build_object('status','invalid');end if;
 select * into e from employees where lower(email)=lower(trim(p_email)) and is_active and role='worker' for update;
 if not found or e.pin_hash is null then return jsonb_build_object('status','denied');end if;
 account_bucket:=encode(digest(p_bucket||'|'||e.id::text,'sha256'),'hex');
 insert into pin_rate_buckets values(account_bucket,t,0) on conflict do nothing;
 select * into b from pin_rate_buckets where bucket=account_bucket for update;
 if b.window_start<=t-interval '10 minutes' then b.window_start:=t;b.count:=0;end if;
 b.count:=b.count+1;update pin_rate_buckets set window_start=b.window_start,count=b.count where bucket=account_bucket;
 if b.count>20 then return jsonb_build_object('status','locked');end if;
 insert into pin_attempts(employee_id) values(e.id) on conflict do nothing;
 select * into a from pin_attempts where employee_id=e.id for update;
 if a.locked_until>t then return jsonb_build_object('status','locked');end if;
 if crypt(p_pin,e.pin_hash)=e.pin_hash then
  update pin_attempts set failures=0,locked_until=null where employee_id=e.id;
  return jsonb_build_object('status','ok','employee_id',e.id);
 end if;
 n:=least(a.failures+1,20);
 update pin_attempts set failures=n,locked_until=t+make_interval(secs=>least(600,power(2,least(n,10))::integer)) where employee_id=e.id;
 return jsonb_build_object('status','locked');
end $$;
revoke all on function public.pin_login_gate(text,text,text) from public,anon,authenticated,naryad_app;
grant execute on function public.pin_login_gate(text,text,text) to service_role;
commit;
