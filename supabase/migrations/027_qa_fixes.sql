-- 027: QA fixes.
-- (1) Master/admin may pause a worker's order (override path so a stuck worker can be freed).
-- (2) One-active-order rule: a worker may have only one order in_progress at a time.
-- (3) review_fallback RPC: deterministic rule layer runs server-side when the model/function
--     is unavailable; fails closed (needs_master) and the client never writes ai_result itself.
-- (4) mark_report_seen fires on completed/ai_review/closed, idempotent per closure revision.

CREATE OR REPLACE FUNCTION public.enforce_order_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
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
 if TG_OP='UPDATE' and current_setting('app.permit_update',true)='1'
    and NEW.status=OLD.status
    and (NEW.permit_kind is distinct from OLD.permit_kind or NEW.permit_note is distinct from OLD.permit_note or NEW.permit_by is distinct from OLD.permit_by or NEW.permit_at is distinct from OLD.permit_at)
    and NEW.assignee_id=OLD.assignee_id and NEW.master_id=OLD.master_id and NEW.equipment_id=OLD.equipment_id
    and NEW.title=OLD.title and NEW.kind=OLD.kind and NEW.priority=OLD.priority and NEW.deadline=OLD.deadline
    and NEW.closure is not distinct from OLD.closure and NEW.ai_result is not distinct from OLD.ai_result
    and NEW.version is not distinct from OLD.version and NEW.is_overdue is not distinct from OLD.is_overdue then
  if actor is null then raise exception 'actor required'; end if;
  if r<>'worker' or actor<>NEW.assignee_id then raise exception 'assigned worker required'; end if;
  if NEW.status not in ('issued','queued','accepted','paused','rework') then raise exception 'permit window closed'; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason) values(NEW.id,actor,OLD.status,NEW.status,current_setting('app.permit_text',true));
  perform pg_notify('orders_changed',NEW.id::text);
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
 elsif NEW.status='paused' and r in ('master','admin') then
  -- Master pause override: frees a stuck worker so another order can be started. Reason required below.
  null;
 else
  if r<>'worker' or actor<>OLD.assignee_id then raise exception 'assigned worker required'; end if;
 end if;
 if NEW.status='closed' and (OLD.ai_result is null or coalesce(OLD.ai_result->>'verdict','')='rework') then raise exception 'review or rework required'; end if;
 if NEW.status in ('rejected','paused','rework') and length(coalesce(current_setting('app.reason',true),''))<3 then raise exception 'reason required'; end if;
 if NEW.status='completed' then
  if length(coalesce(NEW.closure->>'works',''))<12 or coalesce(NEW.closure->>'fault_code','')='' then raise exception 'closure incomplete'; end if;
  if NEW.kind='unplanned' and jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))=0 then raise exception 'after photo required'; end if;
 end if;
 if NEW.status='in_progress' and OLD.permit_kind is null then raise exception 'permit required'; end if;
 if NEW.status='in_progress' and r='worker'
    and exists(select 1 from orders x where x.assignee_id=actor and x.status='in_progress' and x.id<>NEW.id) then
  raise exception 'already has an order in progress: finish or pause it first, or ask the master to pause it';
 end if;
 NEW.version:=OLD.version+1;
 NEW.created_at:=OLD.created_at;
 NEW.started_at:=case when NEW.status='in_progress' then coalesce(OLD.started_at,now()) else OLD.started_at end;
 NEW.closed_at:=case when NEW.status='closed' then now() else OLD.closed_at end;
 insert into order_events(order_id,actor_id,old_status,new_status,reason) values(NEW.id,actor,OLD.status,NEW.status,nullif(current_setting('app.reason',true),''));
 perform pg_notify('orders_changed',NEW.id::text);
 return NEW;
end $function$;

-- (3) server-side deterministic fallback review
drop function if exists public.review_fallback(bigint,integer);
create function public.review_fallback(p_order_id bigint, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders; r text; uid uuid:=auth.uid();
  reasons text[]:='{}'; flags text[]:='{}';
  works text; wnorm text; tnorm text; letters int;
  m jsonb; q numeric; mins int; n work_norms;
  result jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  select role into r from employees where id=uid;
  if r not in ('master','admin') then raise exception 'master action required'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'order unavailable'; end if;
  if o.version<>p_expected_version then raise exception 'stale order version'; end if;
  if o.status<>'completed' then raise exception 'review only from completed'; end if;

  works:=coalesce(o.closure->>'works','');
  if length(works)<12 then reasons:=array_append(reasons,'Описание работ неполное'); end if;
  if coalesce(o.closure->>'fault_code','')='' then reasons:=array_append(reasons,'Нет шифра'); end if;
  if o.kind='unplanned' and jsonb_array_length(coalesce(o.closure->'photos','[]'::jsonb))=0 then reasons:=array_append(reasons,'Нет фото после'); end if;
  if coalesce((o.closure->>'duplicate_warning')::boolean,false) then flags:=array_append(flags,'Правило: фото совпадает с ранее загруженным. Мастер должен проверить источник.'); end if;

  letters:=length(regexp_replace(works,'[^A-Za-zА-Яа-яЁё]','','g'));
  if works<>'' and letters<10 then flags:=array_append(flags,'Правило: в описании работ почти нет текста (символы вместо описания)'); end if;
  if works<>'' and length(works)<30 then flags:=array_append(flags,'Правило: описание работ короче 30 символов'); end if;

  wnorm:=btrim(regexp_replace(lower(works),'[^a-zа-яё0-9]+',' ','g'));
  tnorm:=btrim(regexp_replace(lower(o.title),'[^a-zа-яё0-9]+',' ','g'));
  if wnorm<>'' and tnorm<>'' and (wnorm=tnorm or position(tnorm in wnorm)>0 or (position(wnorm in tnorm)>0 and length(wnorm)>10)) then
    flags:=array_append(flags,'Правило: текст работ повторяет формулировку проблемы');
  end if;

  for m in select * from jsonb_array_elements(coalesce(o.closure->'materials','[]'::jsonb)) loop
    begin q:=coalesce((m->>'quantity')::numeric,0); exception when others then q:=0; end;
    if q<=0 then flags:=array_append(flags,'Правило: количество материала «'||coalesce(m->>'name','?')||'» не положительное');
    elsif q>50 then flags:=array_append(flags,'Правило: количество материала «'||coalesce(m->>'name','?')||'» аномально велико ('||q||')'); end if;
  end loop;

  if o.started_at is not null then
    mins:=greatest(0,round(extract(epoch from (now()-o.started_at))/60))::int;
    for n in select work_type,norm_minutes from work_norms loop
      if position(btrim(regexp_replace(lower(n.work_type),'[^a-zа-яё0-9]+',' ','g')) in tnorm)>0 then
        if mins < greatest(1,round(n.norm_minutes*0.25)) then flags:=array_append(flags,'Правило: выполнено за '||mins||' мин при нормативе '||n.norm_minutes||' мин (демо-справочник) — проверить достоверность'); end if;
        if mins > n.norm_minutes*4 then flags:=array_append(flags,'Правило: выполнение '||mins||' мин заметно дольше норматива '||n.norm_minutes||' мин (демо-справочник)'); end if;
      end if;
    end loop;
  end if;

  result:=jsonb_build_object(
    'mode','rules',
    'verdict', case when coalesce(array_length(reasons,1),0)>0 then 'rework' else 'needs_master' end,
    'score',null,'confidence',null,
    'rule_flags',to_jsonb(flags),
    'reasons',to_jsonb(case when coalesce(array_length(reasons,1),0)+coalesce(array_length(flags,1),0)>0 then reasons||flags else array['Обязательные поля заполнены. Смысл и качество фото не проверены.'] end),
    'limitations',to_jsonb(array['Правила не устанавливают качество физического ремонта']),
    'fallback_reason','Модуль ИИ недоступен. Проверка выполнена на сервере по детерминированным правилам; решение за мастером.');

  perform set_config('app.reason','Проверка выполнена серверными правилами (модуль ИИ недоступен)',true);
  update orders set status='ai_review', ai_result=result where id=o.id;
  return jsonb_build_object('result',result);
end $$;
revoke all on function public.review_fallback(bigint,integer) from public;
grant execute on function public.review_fallback(bigint,integer) to authenticated;

-- (4) report_seen on completed too, idempotent per closure revision
drop function if exists public.mark_report_seen(bigint);
create function public.mark_report_seen(order_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders; uid uuid:=auth.uid(); r text; rev text;
begin
  if uid is null then return; end if;
  select role into r from employees where id=uid;
  if r not in ('master','admin') then return; end if;
  select * into o from orders where id=mark_report_seen.order_id;
  if not found or o.status not in ('completed','ai_review','closed') then return; end if;
  rev:=substring(md5(coalesce(o.closure::text,'')) from 1 for 8);
  if exists(select 1 from order_events where order_events.order_id=o.id and new_status='report_seen'
            and (reason like '%ред. '||rev or (reason='Отчёт получен мастером' and not exists(select 1 from order_events e2 where e2.order_id=o.id and e2.new_status='report_seen' and e2.reason like '%ред. %')))) then return; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason) values(o.id,uid,o.status,'report_seen','Отчёт получен мастером · ред. '||rev);
  perform pg_notify('orders_changed',o.id::text);
end $$;
revoke all on function public.mark_report_seen(bigint) from public;
grant execute on function public.mark_report_seen(bigint) to authenticated;
