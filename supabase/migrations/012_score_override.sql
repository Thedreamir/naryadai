-- Audit #6: master may override the quality score on a closed order; journaled.
create or replace function set_human_score(p_order_id bigint, p_score integer, p_comment text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o orders;
begin
 if p_score is null or p_score<1 or p_score>5 then raise exception 'score must be 1..5'; end if;
 select * into o from orders where id=p_order_id;
 if not found then raise exception 'order unavailable'; end if;
 if o.status<>'closed' then raise exception 'order not closed'; end if;
 perform set_config('app.score_override','1',true);
 update orders set ai_result=coalesce(ai_result,'{}'::jsonb)||jsonb_build_object('human_score',p_score,'human_comment',p_comment,'human_override_at',now()::text) where id=p_order_id returning * into o;
 return jsonb_build_object('id',o.id,'human_score',p_score);
end $$;
revoke all on function set_human_score(bigint,integer,text) from public;
grant execute on function set_human_score(bigint,integer,text) to authenticated;

create or replace function enforce_order_transition() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_actor(); r text:=current_actor_role(); allowed text[];
begin
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
end $$;
