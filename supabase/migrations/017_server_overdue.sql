-- Server-maintained overdue flag: set by the pg_cron deadline watcher, cleared on terminal status.
alter table public.orders add column if not exists is_overdue boolean not null default false;

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
 -- maintain the server-side flag
 perform set_config('app.deadline_watcher','1',true);
 update orders set is_overdue = true
  where deadline < as_of and status not in ('closed','rejected') and not is_overdue;
 update orders set is_overdue = false
  where (deadline >= as_of or status in ('closed','rejected')) and is_overdue;
 if inserted>0 then perform pg_notify('orders_changed','deadlines'); end if;
 return inserted;
end $$;
revoke execute on function check_deadlines(timestamptz) from public;
