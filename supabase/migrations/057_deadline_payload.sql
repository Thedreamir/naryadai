-- STAGED ONLY. Rich metadata and a rule-based alternate-worker suggestion.
-- Not deployed. Specialty matches the current assignee; it is not an equipment qualification.
-- The master checks the task-specific permit and confirms any reassignment.
create or replace function public.check_deadlines(as_of timestamptz default now()) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted integer;
begin
 with pending as (
  select o.*,case when deadline<as_of then 'overdue'
   when status='issued' and created_at<=as_of-(case when priority='emergency' then interval '3 minutes' else interval '10 minutes' end) then 'unaccepted'
   when deadline<=as_of+interval '30 minutes' then 'due_soon' end alert
  from orders o where not cancelled and status not in ('closed','completed','ai_review','rejected')
 ), enriched as (
  select p.*,eq.name equipment_name,sec.name section_name,w.name worker_name,
   latest.reason latest_comment,alt.name alternate_name
  from pending p join equipment eq on eq.id=p.equipment_id
  left join sections sec on sec.id=eq.section_id
  join employees w on w.id=p.assignee_id
  left join lateral (select e.reason from order_events e where e.order_id=p.id and e.created_at<=as_of and nullif(trim(e.reason),'') is not null order by e.created_at desc,e.id desc limit 1) latest on true
  left join lateral (
   select candidate.name from employees candidate
   where candidate.role='worker' and candidate.is_active and candidate.on_shift
    and candidate.id<>p.assignee_id and candidate.specialty=w.specialty
    and not exists(select 1 from orders busy where busy.assignee_id=candidate.id and not busy.cancelled and busy.status in ('issued','queued','accepted','in_progress','paused','rework'))
   order by candidate.id limit 1
  ) alt on p.alert in ('unaccepted','overdue')
 ), targets as (
  select e.*,unnest(case when alert='due_soon' then array[assignee_id] else array[assignee_id,master_id] end) recipient
  from enriched e where alert is not null
 ) insert into notifications(order_id,recipient_id,kind,message,bucket)
 select id,recipient,alert,
  case alert when 'overdue' then 'Просрочен' when 'unaccepted' then 'Не принят' else 'До срока менее 30 минут:' end
  ||' наряд #'||id||': '||title
  ||' · Оборудование: '||equipment_name||' · Участок: '||coalesce(section_name,'не указан')
  ||' · Исполнитель: '||worker_name||' · Статус: '||case status when 'issued' then 'выдан' when 'accepted' then 'принят' when 'queued' then 'в очереди' when 'in_progress' then 'в работе' when 'paused' then 'приостановлен' when 'rework' then 'доработка' else 'уточните в карточке' end
  ||' · Просрочка: '||greatest(0,floor(extract(epoch from as_of-deadline)/60))::bigint||' мин'
  ||' · Последний комментарий: '||coalesce(left(latest_comment,300),'нет')
  ||case when alert in ('unaccepted','overdue') then
    ' · Альтернатива: '||coalesce(alternate_name,'нет свободного исполнителя той же специальности')
    ||'. Подбор по правилам, не назначение. Мастер проверяет специальность задачи и допуск.' else '' end,
  floor(extract(epoch from as_of)/1800)::bigint from targets on conflict do nothing;
 get diagnostics inserted=row_count;
 perform set_config('app.deadline_watcher','1',true);
 update orders set is_overdue=true where deadline<as_of and status not in ('closed','completed','ai_review','rejected','cancelled') and not is_overdue and not cancelled;
 update orders set is_overdue=false where (deadline>=as_of or status in ('closed','completed','ai_review','rejected','cancelled')) and is_overdue and not cancelled;
 if inserted>0 then perform pg_notify('orders_changed','deadlines');end if;
 return inserted;
end $$;
revoke all on function public.check_deadlines(timestamptz) from public,anon,authenticated;
