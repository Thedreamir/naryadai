-- Portable PostgreSQL core; auth adapter for local development. Supabase adapter follows separately.
create extension if not exists pgcrypto;
do $$ begin create role naryad_app nologin; exception when duplicate_object then null; end $$;
create table if not exists employees(id uuid primary key default gen_random_uuid(), name text not null, role text not null check(role in ('master','worker','leader','admin')), specialty text not null default 'Механик', on_shift boolean not null default true);
create table if not exists sections(id bigint generated always as identity primary key,name text not null);
create table if not exists equipment(id bigint generated always as identity primary key,section_id bigint references sections(id),name text not null);
create index if not exists equipment_section_idx on equipment(section_id);
create table if not exists fault_codes(code text primary key,name text not null);
create table if not exists materials(id bigint generated always as identity primary key,name text not null,unit text not null);
create table if not exists crews(id bigint generated always as identity primary key,name text not null);
create table if not exists orders(id bigint generated always as identity primary key, title text not null,kind text not null check(kind in ('planned','unplanned')), equipment_id bigint not null references equipment(id), assignee_id uuid not null references employees(id),master_id uuid not null references employees(id),priority text not null check(priority in ('emergency','high','normal','planned')), status text not null default 'issued' check(status in ('issued','accepted','queued','rejected','in_progress','paused','completed','ai_review','rework','closed')),deadline timestamptz not null,created_at timestamptz not null default now(),started_at timestamptz,closed_at timestamptz,version integer not null default 1,closure jsonb,ai_result jsonb);
create index if not exists orders_assignee_idx on orders(assignee_id);
create index if not exists orders_master_idx on orders(master_id);
create index if not exists orders_equipment_idx on orders(equipment_id);
create index if not exists orders_deadline_idx on orders(deadline) where status not in ('closed','rejected');
create table if not exists order_events(id bigint generated always as identity primary key,order_id bigint not null references orders(id),actor_id uuid not null references employees(id),old_status text,new_status text not null,reason text,created_at timestamptz not null default now());
create index if not exists events_order_idx on order_events(order_id);
create index if not exists events_actor_idx on order_events(actor_id);
create table if not exists ai_cache(input_hash text primary key,prompt_version text not null,model text not null,result jsonb not null,created_at timestamptz not null default now());
create or replace function current_actor() returns uuid language sql stable as $$ select nullif(current_setting('app.actor_id',true),'')::uuid $$;
create or replace function current_actor_role() returns text language sql stable security definer set search_path=public,pg_temp as $$ select role from employees where id=current_actor() $$;
alter table orders enable row level security;
alter table order_events enable row level security;
drop policy if exists read_orders on orders;
create policy read_orders on orders for select to naryad_app using (assignee_id=(select current_actor()) or (select current_actor_role()) in ('master','leader','admin'));
drop policy if exists create_orders on orders;
create policy create_orders on orders for insert to naryad_app with check ((select current_actor_role()) in ('master','admin') and master_id=(select current_actor()));
drop policy if exists update_orders on orders;
create policy update_orders on orders for update to naryad_app using (assignee_id=(select current_actor()) or (select current_actor_role()) in ('master','admin')) with check (assignee_id=(select current_actor()) or (select current_actor_role()) in ('master','admin'));
drop policy if exists read_events on order_events;
create policy read_events on order_events for select to naryad_app using (exists(select 1 from orders where id=order_id));
grant usage on schema public to naryad_app;
grant select on employees,sections,equipment,fault_codes,materials,crews to naryad_app;
grant select,insert,update on orders to naryad_app;
grant select on order_events to naryad_app;
grant usage,select on all sequences in schema public to naryad_app;
create or replace function enforce_order_transition() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_actor(); r text:=current_actor_role(); allowed text[];
begin
 if actor is null then raise exception 'actor required'; end if;
 if TG_OP='INSERT' then
  if r not in ('master','admin') or NEW.status<>'issued' then raise exception 'only master may issue'; end if;
  insert into order_events(order_id,actor_id,new_status) values(NEW.id,actor,NEW.status);
  return NEW;
 end if;
 if NEW.status=OLD.status then raise exception 'status transition required'; end if;
 if NEW.assignee_id<>OLD.assignee_id or NEW.master_id<>OLD.master_id or NEW.equipment_id<>OLD.equipment_id or NEW.title<>OLD.title or NEW.kind<>OLD.kind or NEW.priority<>OLD.priority or NEW.deadline<>OLD.deadline then raise exception 'immutable assignment fields'; end if;
 allowed:=case OLD.status when 'issued' then array['accepted','queued','rejected'] when 'queued' then array['accepted','rejected'] when 'accepted' then array['in_progress'] when 'in_progress' then array['paused','completed'] when 'paused' then array['in_progress'] when 'completed' then array['ai_review'] when 'ai_review' then array['rework','closed'] when 'rework' then array['in_progress'] when 'rejected' then array['issued'] else array[]::text[] end;
 if not NEW.status=any(allowed) then raise exception 'invalid status transition'; end if;
 if NEW.status in ('closed','rework','issued','ai_review') then
  if r not in ('master','admin') then raise exception 'master action required'; end if;
 else
  if r<>'worker' or actor<>OLD.assignee_id then raise exception 'assigned worker required'; end if;
 end if;
 if NEW.status='closed' and (OLD.ai_result is null or coalesce(OLD.ai_result->>'verdict','')='rework') then raise exception 'review or rework required'; end if;
 if NEW.status in ('rejected','paused','rework') and length(coalesce(current_setting('app.reason',true),''))<3 then raise exception 'reason required'; end if;
 if NEW.status='completed' then
  if length(coalesce(NEW.closure->>'works',''))<12 or coalesce(NEW.closure->>'fault_code','')='' then raise exception 'closure incomplete'; end if;
  if NEW.kind='unplanned' and jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))=0 then raise exception 'after photo required'; end if;
 end if;
 NEW.version:=OLD.version+1;
 NEW.created_at:=OLD.created_at;
 NEW.started_at:=case when NEW.status='in_progress' then coalesce(OLD.started_at,now()) else OLD.started_at end;
 NEW.closed_at:=case when NEW.status='closed' then now() else OLD.closed_at end;
 insert into order_events(order_id,actor_id,old_status,new_status,reason) values(NEW.id,actor,OLD.status,NEW.status,nullif(current_setting('app.reason',true),''));
 perform pg_notify('orders_changed',NEW.id::text);
 return NEW;
end $$;
drop trigger if exists order_transition on orders;
create trigger order_transition before update on orders for each row execute function enforce_order_transition();
create or replace function audit_order_insert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if current_actor() is null or current_actor_role() not in ('master','admin') or NEW.status<>'issued' then raise exception 'master required'; end if;
 insert into order_events(order_id,actor_id,new_status) values(NEW.id,current_actor(),NEW.status);perform pg_notify('orders_changed',NEW.id::text);return NEW;
end $$;
drop trigger if exists order_insert on orders;
create trigger order_insert after insert on orders for each row execute function audit_order_insert();
