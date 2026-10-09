-- 039: reviewer corrections. Analytics is global across demo sections for master/leader/admin; worker rating is self only.
-- is_active is account enablement, distinct from on_shift. Existing demo employees default active.
alter table public.employees add column if not exists is_active boolean not null default true;
create or replace function public.current_actor_role() returns text language sql stable security definer set search_path=public,pg_temp as $$ select role from employees where id=current_actor() and is_active $$;
drop function public.worker_rating(timestamptz,timestamptz);
CREATE OR REPLACE FUNCTION public.worker_rating(since timestamp with time zone, until timestamp with time zone)
 RETURNS TABLE(worker_id uuid, name text, closed bigint, on_time bigint, rework bigint, complexity bigint, rejects_unjustified bigint, rejects_unclassified bigint, rejects_justified bigint, quality_avg numeric, quality_n bigint, incomplete_window bigint, f_quality numeric, f_ontime numeric, f_rework numeric, f_volume numeric, f_rejects numeric, total numeric, factors_available integer, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare maxc bigint; myrole text:=current_actor_role(); myid uuid:=current_actor();
begin
  if coalesce(myrole,'') not in ('worker','master','leader','admin') then raise exception 'actor required'; end if;
  select greatest(1, sum(case o.priority when 'emergency' then 3 when 'high' then 2 else 1 end))
    into maxc
    from orders o where not o.cancelled and o.status='closed' and o.closed_at >= since and o.closed_at < until
    group by o.assignee_id order by 1 desc limit 1;
  maxc := coalesce(maxc, 1);
  return query
  with cl as (
    select o.* from orders o where not o.cancelled and o.status='closed' and o.closed_at >= since and o.closed_at < until
      and (myrole in ('master','leader','admin') or o.assignee_id=myid)
  ), rw as (
    -- factor 3: rework event OR repeat failure = SAME fault code on SAME equipment within 7 days.
    -- each closed order counted once; closures <7 days old have an incomplete observation window.
    select c.id from cl c
    where exists (select 1 from order_events e where e.order_id=c.id and e.new_status='rework' and e.created_at<until)
       or exists (select 1 from orders o2 where o2.equipment_id=c.equipment_id and o2.id<>c.id
                  and not o2.cancelled and o2.kind='unplanned' and o2.created_at<until and o2.created_at>c.closed_at and o2.created_at<=c.closed_at+interval '7 days'
                  and (o2.closure->>'fault_code') is not null and (o2.closure->>'fault_code')=(c.closure->>'fault_code'))
  ), base as (
    select c.assignee_id wid,
      count(*) c,
      count(*) filter (where c.closed_at <= c.deadline) ot,
      count(*) filter (where c.id in (select id from rw)) rw,
      count(*) filter (where c.closed_at > until - interval '7 days') iw,
      sum(case c.priority when 'emergency' then 3 when 'high' then 2 else 1 end) cx,
      avg(nullif(c.ai_result->>'human_score','')::numeric) qavg,
      count(nullif(c.ai_result->>'human_score','')) qn
    from cl c
    group by c.assignee_id
  ), rej as (
    -- Explicit codes only. Unknown/disputed reasons require master review; exclude entire factor until classified.
    -- Counts belong to event actor, never to current assignee.
    select e.actor_id wid,
      count(*) filter (where coalesce(e.reason,'')='' or split_part(e.reason,':',1)='unjustified') unj,
      count(*) filter (where coalesce(e.reason,'')<>'' and split_part(e.reason,':',1) not in ('unjustified','no_materials','no_permit','busy_emergency','wrong_specialty')) unc,
      count(*) filter (where split_part(e.reason,':',1) in ('no_materials','no_permit','busy_emergency','wrong_specialty')) justified
    from order_events e
    where e.new_status='rejected' and e.created_at >= since and e.created_at < until
    group by e.actor_id
  )
  select rated.* from (select b.wid, emp.name, b.c, b.ot, b.rw, b.cx, coalesce(r.unj,0), coalesce(r.unc,0), coalesce(r.justified,0), round(b.qavg,2), b.qn, b.iw,
    case when b.qn>0 then round(b.qavg/5*100,1) end,
    round(b.ot::numeric/b.c*100,1),
    round((1-b.rw::numeric/b.c)*100,1),
    round(b.cx::numeric/maxc*100,1),
    case when coalesce(r.unc,0)=0 then greatest(0,100-coalesce(r.unj,0)*25)::numeric end,
    round((
      coalesce(case when b.qn>0 then b.qavg/5*100 end,0)*case when b.qn>0 then 30 else 0 end
      + b.ot::numeric/b.c*100*25
      + (1-b.rw::numeric/b.c)*100*20
      + b.cx::numeric/maxc*100*15
      + case when coalesce(r.unc,0)=0 then greatest(0,100-coalesce(r.unj,0)*25)*10 else 0 end
    )/(60+case when b.qn>0 then 30 else 0 end+case when coalesce(r.unc,0)=0 then 10 else 0 end),1) as total,
    3+case when b.qn>0 then 1 else 0 end+case when coalesce(r.unc,0)=0 then 1 else 0 end,
    'Срез as-of: события и повторы строго до конца периода, не причинный вывод. Закрыто '||b.c||'; в срок '||round(b.ot::numeric/b.c*100)||'% ('||b.ot||'/'||b.c||'); доработка или повтор того же шифра на том же оборудовании за 7 дн: '
      ||b.rw||case when b.iw>0 then ' (у '||b.iw||' закрытий окно повторов неполное)' else '' end
      ||'; сложность '||b.cx||' балла (приближение по приоритету: аварийный=3, высокий=2, прочий=1 — не замеренная трудоёмкость); отказы без причины: '
      ||coalesce(r.unj,0)||case when coalesce(r.unc,0)>0 then '; отказов с неклассифицированной причиной (нужна проверка мастера, фактор отказов исключён): '||r.unc else '' end
      ||case when b.qn>0 then '; качество '||round(b.qavg,1)||'/5 по '||b.qn||' оценкам мастера'
      else '; оценок качества нет — фактор исключён, веса перенормированы' end
  from base b
  join employees emp on emp.id=b.wid
  left join rej r on r.wid=b.wid
  ) rated order by rated.total desc nulls last;
end $function$
;
CREATE OR REPLACE FUNCTION public.anomaly_report(since timestamp with time zone, until timestamp with time zone)
 RETURNS TABLE(kind text, subject text, facts text, recommendation text, weight numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if coalesce(current_actor_role(),'') not in ('master','leader','admin') then raise exception 'master/leader role required'; end if;
  -- 1. Top problem equipment: most unplanned orders + repeated fault code concentration
  return query
  with u as (
    select o.equipment_id, e.name eq, s.name sec, count(*) n,
      sum(extract(epoch from (o.closed_at-o.created_at))/3600.0) down_h
    from orders o join equipment e on e.id=o.equipment_id join sections s on s.id=e.section_id
    where not o.cancelled and o.kind='unplanned' and o.created_at>=since and o.created_at<until and o.status='closed'
    group by 1,2,3 having count(*)>=4
  ), fc as (
    select o.equipment_id, o.closure->>'fault_code' code, count(*) n
    from orders o where not o.cancelled and o.kind='unplanned' and o.created_at>=since and o.created_at<until
      and o.status='closed' and jsonb_typeof(o.closure)='object' and o.closure->>'fault_code' is not null
    group by 1,2
  ), topfc as (
    select distinct on (equipment_id) equipment_id, code, n from fc order by equipment_id, n desc
  )
  select 'top_equipment', u.eq||' ('||u.sec||')',
    u.n||' внеплановых нарядов за период, суммарное время жизни нарядов ~'||round(u.down_h)||' ч (не измеренный простой оборудования)'
      ||case when t.n>=2 then ', из них '||t.n||' с шифром '||t.code else '' end,
    case when t.n>=3 then 'Повторяющийся шифр '||t.code||': возможный сигнал нерешённой причины. Проверить корневую причину и рассмотреть включение в план ППР.'
      else 'Частые внеплановые наряды. Проверить условия эксплуатации и план ППР.' end,
    u.n::numeric + coalesce(t.n,0)
  from u left join topfc t on t.equipment_id=u.equipment_id
  order by 5 desc limit 5;

  -- 2. Repeated fault on same equipment (repair not removing cause)
  return query
  select 'repeat_fault', e.name||' ('||s.name||')',
    'шифр '||(o.closure->>'fault_code')||' закрыт '||count(*)||' раз(а) за период на этом оборудовании',
    'Возможный признак, что ремонт не устраняет причину (сигнал, не доказательство). Рассмотреть углублённую диагностику.',
    count(*)::numeric
  from orders o join equipment e on e.id=o.equipment_id join sections s on s.id=e.section_id
  where not o.cancelled and o.status='closed' and o.created_at>=since and o.created_at<until and jsonb_typeof(o.closure)='object' and o.closure->>'fault_code' is not null
  group by o.equipment_id, e.name, s.name, (o.closure->>'fault_code') having count(*)>=4
  order by 5 desc limit 5;

  -- 3. Failure soon after planned maintenance: each failure linked to its CLOSEST prior PM, counted once
  return query
  with f as (
    select o.id, o.equipment_id, o.created_at,
      (select max(pm.closed_at) from orders pm where pm.equipment_id=o.equipment_id and pm.kind='planned'
        and not pm.cancelled and pm.status='closed' and pm.closed_at<o.created_at) pm_at
    from orders o
    where not o.cancelled and o.kind='unplanned' and o.status='closed' and o.created_at>=since and o.created_at<until
  )
  select 'post_pm_failure', e.name||' ('||s.name||')',
    count(*)||' внеплановых поломки/поломок в течение 7 дней после ближайшего предшествующего ППР',
    'Возможный сигнал о качестве ППР (не доказательство). Проверить полноту плановых работ и контроль после ремонта.',
    count(*)::numeric
  from f join equipment e on e.id=f.equipment_id join sections s on s.id=e.section_id
  where f.pm_at is not null and f.created_at<=f.pm_at+interval '7 days'
  group by f.equipment_id, e.name, s.name having count(*)>=2
  order by 5 desc limit 5;

  -- 4. Anomalous material consumption vs average for same material
  return query
  with m as (
    select o.id oid, e.name eq, (x->>'name') mat, (x->>'quantity')::numeric qty
    from orders o join equipment e on e.id=o.equipment_id,
      lateral jsonb_array_elements(case when jsonb_typeof(o.closure->'materials')='array' then o.closure->'materials' else '[]'::jsonb end) x
    where not o.cancelled and o.status='closed' and o.created_at>=since and o.created_at<until
  ), agg as (
    select mat, avg(qty) av, stddev_pop(qty) sd from m group by 1 having count(*)>=5
  )
  select 'material_outlier', m2.eq,
    'материал «'||m2.mat||'»: списано '||m2.qty||' при среднем '||round(a.av,1)||' по '||'демо-истории',
    'Возможное отклонение расхода. Единицы не нормализованы; сначала проверить сопоставимость единиц и обоснованность списания.',
    (m2.qty-a.av)
  from m m2 join agg a on a.mat=m2.mat
  where a.sd>0 and m2.qty>a.av+2*a.sd
  order by 5 desc limit 5;
end $function$
;
create or replace function public.manage_order(p_order_id bigint, p_action text, p_assignee uuid default null,
  p_priority text default null, p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=current_actor_role(); o orders; msg text;
begin
  if coalesce(r,'') not in ('master','admin') then raise exception 'master action required'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'order unavailable'; end if;
  if o.cancelled then raise exception 'order cancelled'; end if;
  if o.status in ('closed','completed','ai_review') then raise exception 'order already past review'; end if;
  perform set_config('app.manage_order','1',true);
  if p_action='reassign' then
    if o.status not in ('issued','queued','rejected') then raise exception 'reassign only issued/queued/rejected'; end if;
    if p_assignee is null then raise exception 'assignee required'; end if;
    if not exists(select 1 from employees where id=p_assignee and role='worker' and is_active) then raise exception 'assignee must be a worker'; end if;
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

CREATE OR REPLACE FUNCTION public.enforce_order_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;
revoke all on function public.worker_rating(timestamptz,timestamptz) from public,anon;
grant execute on function public.worker_rating(timestamptz,timestamptz) to authenticated;
select pg_notify('pgrst','reload schema');

CREATE OR REPLACE FUNCTION public.review_fallback(p_order_id bigint, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o orders; r text; uid uuid:=auth.uid();
  reasons text[]:='{}'; flags text[]:='{}';
  works text; wnorm text; tnorm text; letters int;
  m jsonb; q numeric; mins int; n work_norms;
  result jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  r:=current_actor_role();
  if coalesce(r,'') not in ('master','admin') then raise exception 'master action required'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_report_seen(order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o orders; uid uuid:=auth.uid(); r text; rev text;
begin
  if uid is null then raise exception 'actor required'; end if;
  r:=current_actor_role();
  if coalesce(r,'') not in ('master','admin') then raise exception 'master action required'; end if;
  select * into o from orders where id=mark_report_seen.order_id;
  if not found or o.status not in ('completed','ai_review','closed') then return; end if;
  rev:=substring(md5(coalesce(o.closure::text,'')) from 1 for 8);
  if exists(select 1 from order_events where order_events.order_id=o.id and new_status='report_seen'
            and (reason like '%ред. '||rev or (reason='Отчёт получен мастером' and not exists(select 1 from order_events e2 where e2.order_id=o.id and e2.new_status='report_seen' and e2.reason like '%ред. %')))) then return; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason) values(o.id,uid,o.status,'report_seen','Отчёт получен мастером · ред. '||rev);
  perform pg_notify('orders_changed',o.id::text);
end $function$
;

-- PIN scope/audit definition finalized in mandatory migration 071.
CREATE OR REPLACE FUNCTION public.pin_unlock(employee_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare uid uuid:=auth.uid(); r text; target uuid; had boolean;
begin
  if uid is null then raise exception 'actor required'; end if;
  r:=current_actor_role();
  if coalesce(r,'') not in ('master','admin') then raise exception 'master required'; end if;
  select id into target from employees where email=employee_email;
  if target is null then raise exception 'employee not found'; end if;
  select exists(select 1 from pin_attempts where employee_id=target and (failures>0 or locked_until is not null)) into had;
  delete from pin_attempts where employee_id=target;
  return jsonb_build_object('cleared',had);
end $function$
;

CREATE OR REPLACE FUNCTION public.check_deadlines(as_of timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare inserted integer;
begin
 with pending as (
 select o.*,case when deadline<as_of then 'overdue' when status='issued' and created_at<as_of-(case when priority='emergency' then interval '3 minutes' else interval '10 minutes' end) then 'unaccepted' when deadline<=as_of+interval '30 minutes' then 'due_soon' end alert from orders o where not cancelled and status not in ('closed','completed','ai_review','rejected')
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
end $function$
;
revoke all on function public.check_deadlines(timestamptz) from public,anon,authenticated;
select pg_notify('pgrst','reload schema');
