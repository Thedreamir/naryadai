-- Run ONLY in a new synthetic Supabase test project, after core migrations.
create or replace function current_actor() returns uuid language sql stable as $$ select auth.uid() $$;
-- Policies use a common group; authenticated receives that role's narrow grants.
grant naryad_app to authenticated;
-- Supabase defaults must not override narrow application grants.
revoke all on orders,order_events,notifications,ai_cache from anon,authenticated;
grant select,insert,update on orders to authenticated;
grant select on order_events,notifications,order_report,employee_ratings,sections,equipment,fault_codes,materials,crews to authenticated;
grant usage,select on all sequences in schema public to authenticated;
create or replace function transition_order(order_id bigint,target_status text,expected_version integer,reason_text text default '',closure_data jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row_order orders;
begin
 select * into row_order from orders where id=order_id for update;
 if not found then raise exception 'order unavailable'; end if;
 if row_order.version<>expected_version then raise exception 'stale order version'; end if;
 perform set_config('app.reason',reason_text,true);
 update orders set status=target_status,closure=case when target_status='completed' then closure_data else closure end where id=order_id returning * into row_order;
 return jsonb_build_object('id',row_order.id,'status',row_order.status,'version',row_order.version);
end $$;
revoke all on function transition_order(bigint,text,integer,text,jsonb) from public;
grant execute on function transition_order(bigint,text,integer,text,jsonb) to authenticated;
-- Do not expose users' roles as a writable self-service table.
revoke insert,update,delete on employees from authenticated,anon,naryad_app;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('repair-photos','repair-photos',false,400000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists repair_photo_insert on storage.objects;
create policy repair_photo_insert on storage.objects for insert to authenticated with check(current_actor_role() in ('worker','master','leader','admin') and bucket_id='repair-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists repair_photo_read on storage.objects;
create policy repair_photo_read on storage.objects for select to authenticated using(current_actor_role() in ('worker','master','leader','admin') and bucket_id='repair-photos' and ((storage.foldername(name))[1]=auth.uid()::text or current_actor_role() in ('master','leader','admin')));
-- Realtime publication guarded for repeat deployment.
do $$ begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end $$;

-- Mandatory final hosted hardening. Apply all numbered core migrations first.

-- 064_employee_safe_columns.sql
-- Local security preparation only. Validate current columns/grants before live apply.
-- RLS does not redact columns. Revoke broad SELECT, then explicit safe column ACL.
begin;
revoke select on public.employees from public, anon, authenticated, naryad_app;
-- Revoke possible earlier column-level grants on the secret as well.
revoke select(pin_hash) on public.employees from public, anon, authenticated, naryad_app;
grant select(id,name,role,specialty,on_shift,email,is_active,brigade)
 on public.employees to authenticated,naryad_app;
commit;
-- service_role and SECURITY DEFINER PIN functions retain existing access.

-- 068_active_metadata_storage.sql
-- Proposed local hardening. NOT a deployed or numbered migration.
-- Merge owner: lane 6. Review against current policies/grants before adoption.
-- Relies on migration 039 current_actor_role() filtering inactive employees.
begin;
drop policy if exists read_orders on public.orders;
create policy read_orders on public.orders for select to naryad_app using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and (assignee_id=(select current_actor()) or (select current_actor_role()) in ('master','leader','admin'))
);
drop policy if exists update_orders on public.orders;
create policy update_orders on public.orders for update to naryad_app using (
 (coalesce((select current_actor_role()),'')='worker' and assignee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','admin')
) with check (
 (coalesce((select current_actor_role()),'')='worker' and assignee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','admin')
);
drop policy if exists read_notifications on public.notifications;
create policy read_notifications on public.notifications for select to naryad_app using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and recipient_id=(select current_actor())
);
drop policy if exists declarations_read on public.order_declarations;
create policy declarations_read on public.order_declarations for select to authenticated using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and exists(select 1 from public.orders o where o.id=order_id)
);
drop policy if exists declarations_insert on public.order_declarations;
create policy declarations_insert on public.order_declarations for insert to authenticated with check (
 coalesce((select current_actor_role()),'')='worker'
 and declared_by=(select current_actor())
 and exists(select 1 from public.orders o where o.id=order_id and o.assignee_id=(select current_actor()) and o.status in ('accepted','in_progress','rework','paused'))
);
drop policy if exists employee_permits_read on public.employee_permits;
create policy employee_permits_read on public.employee_permits for select to authenticated using (
 (coalesce((select current_actor_role()),'')='worker' and employee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','leader','admin')
);
drop policy if exists repair_photo_insert on storage.objects;
drop policy if exists repair_photo_read on storage.objects;
create policy repair_photo_insert on storage.objects for insert to authenticated with check(current_actor_role() in ('worker','master','leader','admin') and bucket_id='repair-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy repair_photo_read on storage.objects for select to authenticated using(current_actor_role() in ('worker','master','leader','admin') and bucket_id='repair-photos' and ((storage.foldername(name))[1]=auth.uid()::text or current_actor_role() in ('master','leader','admin')));
commit;

-- 071_pin_security.sql
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

-- 072_declaration_retry_key.sql
-- Immutable retry dedupe. Existing evidence stays unchanged and retains timestamps.
-- A new order version gets a new key, preserving a later safety declaration.
begin;
alter table public.order_declarations add column if not exists declarations_idempotency_key text;
create unique index if not exists declarations_retry_key on public.order_declarations(declarations_idempotency_key);
commit;

-- 073_knowledge_extract_scope.sql
-- LOCAL ONLY. Approved status alone is never a worker extraction permit.
begin;
alter table public.knowledge_docs add column if not exists content_domain text not null default 'unclassified',add column if not exists safety_sensitive boolean not null default true,add column if not exists worker_extract_eligible boolean not null default false;
alter table public.repair_memory add column if not exists content_domain text not null default 'unclassified',add column if not exists safety_sensitive boolean not null default true,add column if not exists worker_extract_eligible boolean not null default false;
-- No blanket backfill. A human reviews each source's domain/eligibility separately.
commit;

-- 074_order_write_boundary.sql
-- LOCAL CANDIDATE ONLY. Narrow direct writes; validated RPCs retain actor guards.
begin;
revoke update on public.orders from public,anon,authenticated,naryad_app;
grant update(status,closure,ai_result) on public.orders to authenticated,naryad_app;
-- record_permit already checks role, assignee, version and format through trigger.
alter function public.record_permit(bigint,text,text,integer) security definer;
create or replace function public.guard_order_evidence_columns() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=current_actor_role();
begin
 if NEW.cancelled is distinct from OLD.cancelled and not (coalesce(r,'') in ('master','admin') and current_setting('app.manage_order',true)='1' and NEW.status=OLD.status) then raise exception 'cancel via master manage_order only';end if;
 if NEW.permit_kind is distinct from OLD.permit_kind or NEW.permit_note is distinct from OLD.permit_note or NEW.permit_by is distinct from OLD.permit_by or NEW.permit_at is distinct from OLD.permit_at then
  if OLD.permit_kind is not null or NEW.status<>OLD.status or coalesce(current_setting('app.permit_update',true),'')<>'1' or coalesce(r,'')<>'worker' or current_actor() is distinct from OLD.assignee_id or NEW.permit_by is distinct from current_actor() or NEW.permit_at is null or NEW.permit_at<>transaction_timestamp() then raise exception 'permit immutable except record_permit';end if;
 end if;
 if NEW.status='in_progress' and NEW.status<>OLD.status then
  if not exists(select 1 from public.order_declarations d where d.order_id=OLD.id and d.declared_by=current_actor() and d.confirmed and not d.excluded_from_evidence and d.phase='pre_work' and d.text='Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)') or not exists(select 1 from public.order_declarations d where d.order_id=OLD.id and d.declared_by=current_actor() and d.confirmed and not d.excluded_from_evidence and d.phase='pre_work' and d.text='Подтверждаю лично: использую средства защиты, зона работ безопасна') then raise exception 'two required pre-work declarations required';end if;
 end if;
 return NEW;
end $$;
drop trigger if exists aa_guard_order_evidence_columns on public.orders;
create trigger aa_guard_order_evidence_columns before update on public.orders for each row execute function public.guard_order_evidence_columns();
create or replace function public.start_work_with_declarations(p_order_id bigint,p_expected_version integer,p_texts text[])returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb;o orders;required text[]:=array['Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)','Подтверждаю лично: использую средства защиты, зона работ безопасна'];
begin
 select * into o from orders where id=p_order_id for update;
 if not found or o.assignee_id is distinct from auth.uid() or coalesce(current_actor_role(),'')<>'worker' then raise exception 'assigned active worker required';end if;
 if o.version<>p_expected_version then raise exception 'stale order version';end if;
 if cardinality(p_texts) is distinct from 2 or not (p_texts @> required and required @> p_texts) then raise exception 'exactly two required declarations';end if;
 insert into order_declarations(order_id,declared_by,phase,text)select p_order_id,auth.uid(),'pre_work',t from unnest(p_texts)t;
 r:=transition_order(p_order_id,'in_progress',p_expected_version,'',null,null,'');return r;
end $$;
revoke all on function public.guard_order_evidence_columns() from public;
commit;

-- 075_server_declarations.sql
-- LOCAL ONLY. No direct writes, server times, validated actor/order window.
begin;
revoke insert,update,delete on public.order_declarations from public,anon,authenticated,naryad_app;
alter function public.start_work_with_declarations(bigint,integer,text[]) security definer;
create or replace function public.stamp_declaration_time()returns trigger language plpgsql set search_path=public,pg_temp as $$begin NEW.declared_at:=transaction_timestamp();return NEW;end$$;
drop trigger if exists stamp_declaration_time on public.order_declarations;
create trigger stamp_declaration_time before insert on public.order_declarations for each row execute function public.stamp_declaration_time();
create or replace function public.record_late_declarations(p_order_id bigint,p_phase text,p_texts text[],p_version integer)returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders;t text;k text;
begin
 select * into o from orders where id=p_order_id for update;
 if not found or current_actor() is distinct from o.assignee_id or coalesce(current_actor_role(),'')<>'worker' or o.cancelled then raise exception 'assigned active worker required';end if;
 if o.version<>p_version then raise exception 'stale order version';end if;
 if o.status not in ('in_progress','rework','paused') or p_phase not in ('pre_work_late','pre_work_at_surrender','post_work') then raise exception 'declaration window closed';end if;
 if cardinality(p_texts) is null or cardinality(p_texts) not between 1 and 2 then raise exception 'declaration count invalid';end if;
 foreach t in array p_texts loop
  if t is null or length(trim(t)) not between 20 and 500 then raise exception 'declaration text invalid';end if;
  k:=encode(digest(jsonb_build_array(current_actor(),p_order_id,p_version,p_phase,t)::text,'sha256'),'hex');
  insert into order_declarations(order_id,declared_by,phase,text,confirmed,declarations_idempotency_key)values(p_order_id,current_actor(),p_phase,t,true,k)on conflict(declarations_idempotency_key)do nothing;
 end loop;
end$$;
revoke all on function public.record_late_declarations(bigint,text,text[],integer) from public;
grant execute on function public.record_late_declarations(bigint,text,text[],integer) to authenticated;
commit;

-- 076_manual_master_decision.sql
-- LOCAL ONLY. Explicit audited master decision, never relabelled as AI evidence.
begin;
create table if not exists public.manual_review_decisions(id bigint generated always as identity primary key,order_id bigint not null references orders(id),actor_id uuid not null references employees(id),decision text not null,reason text not null,score integer,review_failure text not null,created_at timestamptz not null default now());
alter table public.manual_review_decisions enable row level security;
drop policy if exists manual_decision_read on public.manual_review_decisions;
create policy manual_decision_read on public.manual_review_decisions for select to authenticated using(exists(select 1 from orders where id=order_id));
grant select on public.manual_review_decisions to authenticated;
create or replace function public.manual_master_decision(p_id bigint,p_version integer,p_decision text,p_score integer,p_reason text,p_failure text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders;actor uuid:=current_actor();r text:=current_actor_role();result jsonb;prior_role text:=current_setting('request.jwt.claim.role',true);
begin
 if actor is null or coalesce(r,'') not in ('master','admin') then raise exception 'active master required';end if;
 if p_decision is null or p_decision not in ('close','rework') or length(trim(coalesce(p_reason,'')))<3 or length(trim(coalesce(p_failure,'')))<3 then raise exception 'decision reason and review failure required';end if;
 if p_decision='close' and (p_score is null or p_score not between 1 and 5) then raise exception 'human score 1..5 required';end if;
 select * into o from orders where id=p_id for update;
 if p_version is null or not found or o.cancelled or o.status<>'completed' or o.version<>p_version then raise exception 'stale manual decision';end if;
 -- Service gate for exactly this server-built intermediate result. Not client AI.
 perform set_config('request.jwt.claim.role','service_role',true);
 update orders set status='ai_review',ai_result=jsonb_build_object('verdict','needs_master_review','mode','manual','score',null,'confidence',null,'needs_master_review',true,'reasons',jsonb_build_array('Проверка недоступна: '||left(p_failure,500)),'report_master','Решение мастера без автоматической проверки','limitations',jsonb_build_array('Не выполнена автоматическая проверка'),'human_score',null)where id=p_id returning * into o;
 perform set_config('request.jwt.claim.role',coalesce(prior_role,''),true);
 insert into manual_review_decisions(order_id,actor_id,decision,reason,score,review_failure)values(p_id,actor,p_decision,left(p_reason,1000),case when p_decision='close' then p_score else null end,left(p_failure,1000));
 result:=transition_order(p_id,case when p_decision='close' then 'closed' else 'rework' end,o.version,p_reason,null,case when p_decision='close' then p_score else null end,p_reason);
 return result;
end$$;
revoke all on function public.manual_master_decision(bigint,integer,text,integer,text,text) from public,anon,naryad_app;
grant execute on function public.manual_master_decision(bigint,integer,text,integer,text,text) to authenticated;
commit;

-- 077_canonical_photo_gate.sql
-- LOCAL CANDIDATE. Unplanned completion fails closed until server ingest is wired.
-- This table is written ONLY by trusted canonical ingest, never by browser metadata.
begin;
create table if not exists public.canonical_photo_evidence(
 id bigint generated always as identity primary key,order_id bigint not null references orders(id),uploaded_by uuid not null references employees(id),storage_path text not null unique,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),byte_size integer not null check(byte_size between 1 and 290000),mime_type text not null check(mime_type='image/jpeg'),phase text not null check(phase in ('before','after')),received_at timestamptz not null default now(),decoder_version text not null,unique(order_id,sha256,phase));
alter table public.canonical_photo_evidence enable row level security;
revoke all on public.canonical_photo_evidence from public,anon,authenticated,naryad_app;
grant select,insert on public.canonical_photo_evidence to service_role;
grant usage,select on sequence public.canonical_photo_evidence_id_seq to service_role;
create or replace function public.require_canonical_after_evidence()returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare uri text;payload bytea;h text;
begin
 if NEW.status<>'completed' or NEW.status=OLD.status or NEW.kind<>'unplanned' then return NEW;end if;
 if jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))=0 then raise exception 'after photo required';end if;
 for uri in select jsonb_array_elements_text(NEW.closure->'photos')loop
  if uri !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$' or length(uri)>400000 then raise exception 'canonical JPEG required';end if;
  begin payload:=decode(split_part(uri,',',2),'base64');exception when others then raise exception 'invalid canonical image';end;
  if octet_length(payload)>290000 or substring(payload from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'invalid canonical image';end if;
  h:=encode(digest(payload,'sha256'),'hex');
  if not exists(select 1 from canonical_photo_evidence e where e.order_id=OLD.id and e.uploaded_by=OLD.assignee_id and e.phase='after' and e.sha256=h and e.byte_size=octet_length(payload) and e.received_at>=OLD.created_at)then raise exception 'server verified after photo required; canonical ingest unavailable';end if;
 end loop;
 return NEW;
end$$;
drop trigger if exists ac_canonical_after_evidence on public.orders;
create trigger ac_canonical_after_evidence before update on public.orders for each row execute function public.require_canonical_after_evidence();
revoke all on function public.require_canonical_after_evidence() from public;
commit;
