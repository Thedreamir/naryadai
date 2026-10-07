-- 038: master may reassign, cancel or reprioritize an open order (case PDF 5.1.5); all logged.
-- orders table trigger blocks direct field edits, so changes go through this guarded RPC
-- which sets a one-shot gate and writes order_events rows itself.
alter table public.orders add column if not exists cancelled boolean not null default false;

create or replace function public.manage_order(p_order_id bigint, p_action text, p_assignee uuid default null,
  p_priority text default null, p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=current_actor_role(); o orders; msg text;
begin
  if coalesce(r,'') not in ('master','admin') then raise exception 'master action required'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'order unavailable'; end if;
  if o.status in ('closed','completed','ai_review') then raise exception 'order already past review'; end if;
  perform set_config('app.manage_order','1',true);
  if p_action='reassign' then
    if p_assignee is null then raise exception 'assignee required'; end if;
    if not exists(select 1 from employees where id=p_assignee and role='worker') then raise exception 'assignee must be a worker'; end if;
    update orders set assignee_id=p_assignee, version=version+1 where id=p_order_id;
    msg:='Переназначен мастером';
  elsif p_action='priority' then
    if coalesce(p_priority,'') not in ('emergency','high','normal','planned') then raise exception 'bad priority'; end if;
    update orders set priority=p_priority, version=version+1 where id=p_order_id;
    msg:='Приоритет изменён мастером на '||p_priority;
  elsif p_action='cancel' then
    update orders set cancelled=true, version=version+1 where id=p_order_id;
    msg:='Наряд отменён мастером';
  else raise exception 'unknown action'; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason)
    values(p_order_id,current_actor(),o.status,(select status from orders where id=p_order_id),
      msg||case when p_reason<>'' then ': '||p_reason else '' end);
  perform pg_notify('orders_changed',p_order_id::text);
  return jsonb_build_object('id',p_order_id,'action',p_action);
end $$;
revoke all on function public.manage_order(bigint,text,uuid,text,text) from public;
grant execute on function public.manage_order(bigint,text,uuid,text,text) to authenticated;
select pg_notify('pgrst','reload schema');
-- widen the transition-gate trigger: allow field edits when manage_order RPC set its one-shot gate
create or replace function public.enforce_order_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
declare actor uuid:=current_actor(); r text:=current_actor_role(); allowed text[];
begin
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
 insert into order_events(order_id,actor_id,old_status,new_status,reason)
   values(NEW.id,actor,OLD.status,NEW.status,coalesce(current_setting('app.reason',true),''));
 perform pg_notify('orders_changed',NEW.id::text);
 return NEW;
end $function$;
