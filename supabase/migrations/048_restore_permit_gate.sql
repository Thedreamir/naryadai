-- 048: restore the permit gate in enforce_order_transition.
-- 038 rewrote the trigger with the app.manage_order gate and dropped the app.permit_update branch,
-- so record_permit updates failed with 'status transition required'. Found by worker phone e2e (order #670).
create or replace function public.enforce_order_transition() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_actor(); r text:=current_actor_role(); allowed text[];
begin
 if TG_OP='UPDATE' and OLD.cancelled then raise exception 'order cancelled'; end if;
 if TG_OP='UPDATE' and current_setting('app.deadline_watcher',true)='1'
    and NEW.status=OLD.status and (NEW.is_overdue is distinct from OLD.is_overdue)
    and NEW.assignee_id=OLD.assignee_id and NEW.master_id=OLD.master_id and NEW.equipment_id=OLD.equipment_id
    and NEW.title=OLD.title and NEW.kind=OLD.kind and NEW.priority=OLD.priority and NEW.deadline=OLD.deadline
    and NEW.closure is not distinct from OLD.closure and NEW.ai_result is not distinct from OLD.ai_result
    and NEW.cancelled is not distinct from OLD.cancelled
    and NEW.version is not distinct from OLD.version then
  return NEW;
 end if;
 if TG_OP='UPDATE' and current_setting('app.manage_order',true)='1' and NEW.status=OLD.status then
  return NEW;
 end if;
 -- permit gate (restored from 027): worker records/corrects own permit without a status change
 if TG_OP='UPDATE' and current_setting('app.permit_update',true)='1'
    and NEW.status=OLD.status
    and (NEW.permit_kind is distinct from OLD.permit_kind or NEW.permit_note is distinct from OLD.permit_note or NEW.permit_by is distinct from OLD.permit_by or NEW.permit_at is distinct from OLD.permit_at)
    and NEW.assignee_id=OLD.assignee_id and NEW.master_id=OLD.master_id and NEW.equipment_id=OLD.equipment_id
    and NEW.title=OLD.title and NEW.kind=OLD.kind and NEW.priority=OLD.priority and NEW.deadline=OLD.deadline
    and NEW.closure is not distinct from OLD.closure and NEW.ai_result is not distinct from OLD.ai_result
    and NEW.cancelled is not distinct from OLD.cancelled
    and NEW.version is not distinct from OLD.version and NEW.is_overdue is not distinct from OLD.is_overdue then
  if actor is null then raise exception 'actor required'; end if;
  if r<>'worker' or actor<>NEW.assignee_id then raise exception 'assigned worker required'; end if;
  if NEW.status not in ('issued','queued','accepted','paused','rework') then raise exception 'permit window closed'; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason) values(NEW.id,actor,OLD.status,NEW.status,current_setting('app.permit_text',true));
  perform pg_notify('orders_changed',NEW.id::text);
  return NEW;
 end if;
 if actor is null or r is null then raise exception 'actor required'; end if;
 if TG_OP='INSERT' then
  if r not in ('master','admin') or NEW.status<>'issued' then raise exception 'only master may issue'; end if;
  insert into order_events(order_id,actor_id,new_status) values(NEW.id,actor,NEW.status);
  return NEW;
 end if;
 if NEW.status=OLD.status then
  if NEW.status='closed' and current_setting('app.score_override',true)='1' and r in ('master','admin')
     and NEW.ai_result is distinct from OLD.ai_result and NEW.closure is not distinct from OLD.closure
     and NEW.version is not distinct from OLD.version then
   insert into order_events(order_id,actor_id,old_status,new_status,reason) values(NEW.id,actor,OLD.status,NEW.status,'Оценка мастера изменена');
   perform pg_notify('orders_changed',NEW.id::text);
   return NEW;
  end if;
  raise exception 'status transition required';
 end if;
 if NEW.assignee_id<>OLD.assignee_id or NEW.master_id<>OLD.master_id or NEW.equipment_id<>OLD.equipment_id or NEW.title<>OLD.title or NEW.kind<>OLD.kind or NEW.priority<>OLD.priority or NEW.deadline<>OLD.deadline then raise exception 'immutable assignment fields'; end if;
 allowed:=case OLD.status when 'issued' then array['accepted','queued','rejected'] when 'queued' then array['accepted','rejected'] when 'accepted' then array['in_progress'] when 'in_progress' then array['paused','completed'] when 'accepted' then array['in_progress'] when 'paused' then array['in_progress'] when 'completed' then array['ai_review'] when 'ai_review' then array['rework','closed'] when 'rework' then array['in_progress'] when 'rejected' then array['issued'] else array[]::text[] end;
 if not NEW.status=any(allowed) then raise exception 'invalid status transition'; end if;
 if NEW.status in ('closed','rework','issued','ai_review') then
  if r not in ('master','admin') then raise exception 'master action required'; end if;
 else
  if r<>'worker' or actor<>OLD.assignee_id then raise exception 'assigned worker required'; end if;
 end if;
 insert into order_events(order_id,actor_id,old_status,new_status,reason)
   values(NEW.id,actor,OLD.status,NEW.status,coalesce(current_setting('app.reason',true),''));
 perform pg_notify('orders_changed',NEW.id::text);
 return NEW;
end $$;
