BEGIN;
DO $$ BEGIN IF (SELECT phase FROM public.tekton_notify_release_backup)<>2 THEN RAISE EXCEPTION 'Wrong release phase; STOP'; END IF; END $$;
DO $live$ DECLARE t record; BEGIN
FOR t IN SELECT tg.tgname,p.proname,pg_get_functiondef(p.oid) src FROM pg_trigger tg JOIN pg_proc p ON p.oid=tg.tgfoid WHERE tg.tgrelid='public.orders'::regclass AND NOT tg.tgisinternal AND (tg.tgtype & 4)=4 LOOP
IF t.proname NOT IN ('audit_order_insert','notify_order_push') THEN RAISE EXCEPTION 'Unknown INSERT trigger: %, function %. STOP and inspect.',t.tgname,t.proname; END IF;
IF t.proname='audit_order_insert' AND t.src ~* '(notifications|http_post|send.push)' THEN RAISE EXCEPTION 'Audit trigger also notifies; reconcile before install'; END IF;
END LOOP;
END $live$;
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
create or replace function public.notify_new_order_durable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
if new.cancelled or new.status not in ('issued','queued') or new.assignee_id is null then return new;end if;
insert into notifications(order_id,recipient_id,kind,message,bucket)
values(new.id,new.assignee_id,'new_order','Новый наряд #'||new.id||': '||new.title,0)
on conflict(order_id,recipient_id,kind,bucket) do nothing;
return new;
end $$;
revoke all on function public.notify_new_order_durable() from public,anon,authenticated;
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
CREATE TRIGGER tekton_new_order_durable AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_new_order_durable();
DO $verify$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='tekton_new_order_durable') THEN RAISE EXCEPTION 'Trigger absent'; END IF;
IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.telegram_connections'::regclass,'public.telegram_pair_requests'::regclass,'public.telegram_updates'::regclass,'public.telegram_deliveries'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS absent'; END IF;
IF has_table_privilege('authenticated','public.telegram_connections','SELECT') OR has_function_privilege('authenticated','public.telegram_pending_bind(text,text,text,bigint)','EXECUTE') THEN RAISE EXCEPTION 'Unexpected client permissions'; END IF;
END $verify$;
UPDATE public.tekton_notify_release_backup SET phase=3;
COMMIT;
SELECT phase,'FOUNDATION_INSTALLED_NOT_PHONE_DELIVERY' AS status FROM public.tekton_notify_release_backup;
