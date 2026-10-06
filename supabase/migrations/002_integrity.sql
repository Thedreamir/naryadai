-- Protect actor-independent fields, reference data and audit immutability.
create or replace function closure_integrity() returns trigger language plpgsql as $$ begin
 if NEW.closure is distinct from OLD.closure and NEW.status<>'completed' then raise exception 'closure only allowed on completion'; end if;
 if NEW.ai_result is distinct from OLD.ai_result and not (NEW.status='ai_review' and current_actor_role() in ('master','admin')) then raise exception 'review result cannot be written by worker'; end if;
 if NEW.status='completed' then
  if not exists(select 1 from fault_codes where code=NEW.closure->>'fault_code') then raise exception 'unknown fault code'; end if;
  if jsonb_typeof(coalesce(NEW.closure->'materials','[]'::jsonb))<>'array' then raise exception 'invalid materials'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(NEW.closure->'materials','[]'::jsonb)) m where coalesce(m->>'quantity','0')::numeric<=0 or not exists(select 1 from materials where name=m->>'name')) then raise exception 'invalid material reference or quantity'; end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(NEW.closure->'photos','[]'::jsonb)) p where p !~ '^data:image/(jpeg|png|webp);base64,' or length(p)>400000) then raise exception 'invalid image or image too large'; end if;
  if jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))>5 then raise exception 'at most five photos'; end if;
 end if;
 return NEW;
end $$;
drop trigger if exists a_closure_integrity on orders;
create trigger a_closure_integrity before update on orders for each row execute function closure_integrity();
create table if not exists notifications(id bigint generated always as identity primary key,order_id bigint not null references orders(id),recipient_id uuid not null references employees(id),kind text not null,message text not null,created_at timestamptz not null default now(),bucket bigint not null,unique(order_id,recipient_id,kind,bucket));
create index if not exists notifications_recipient_idx on notifications(recipient_id);
create index if not exists notifications_order_idx on notifications(order_id);
alter table notifications enable row level security;
drop policy if exists read_notifications on notifications;
create policy read_notifications on notifications for select to naryad_app using(recipient_id=(select current_actor()));
grant select on notifications to naryad_app;
create or replace function check_deadlines(as_of timestamptz default now()) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted integer;
begin
 with pending as (
 select o.*,case when deadline<as_of then 'overdue' when status='issued' and created_at<as_of-(case when priority='emergency' then interval '3 minutes' else interval '10 minutes' end) then 'unaccepted' when deadline<=as_of+interval '30 minutes' then 'due_soon' end alert from orders o where status not in ('closed','completed','ai_review','rejected')
 ), targets as (
 select p.*,unnest(case when alert='due_soon' then array[assignee_id] else array[assignee_id,master_id] end) recipient from pending p where alert is not null
 ) insert into notifications(order_id,recipient_id,kind,message,bucket)
 select id,recipient,alert,case alert when 'overdue' then 'Просрочен наряд #'||id||': '||title when 'unaccepted' then 'Не принят наряд #'||id||': '||title else 'До срока наряда #'||id||' осталось менее 30 минут' end, floor(extract(epoch from as_of)/1800)::bigint from targets on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted>0 then perform pg_notify('orders_changed','deadlines'); end if;
 return inserted;
end $$;
revoke execute on function check_deadlines(timestamptz) from public;
