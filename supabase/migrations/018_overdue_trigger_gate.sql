-- Allow the cron deadline watcher to maintain orders.is_overdue without an actor context.
CREATE OR REPLACE FUNCTION public.enforce_order_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor uuid:=current_actor(); r text:=current_actor_role(); allowed text[];
begin
 if TG_OP='UPDATE' and current_setting('app.deadline_watcher',true)='1'
    and NEW.status=OLD.status and (NEW.is_overdue is distinct from OLD.is_overdue)
    and NEW.assignee_id=OLD.assignee_id and NEW.master_id=OLD.master_id and NEW.equipment_id=OLD.equipment_id
    and NEW.title=OLD.title and NEW.kind=OLD.kind and NEW.priority=OLD.priority and NEW.deadline=OLD.deadline
    and NEW.closure is not distinct from OLD.closure and NEW.ai_result is not distinct from OLD.ai_result
    and NEW.version is not distinct from OLD.version then
  return NEW;
 end if;
 if actor is null then raise exception 'actor required'; end if;
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
end $function$

