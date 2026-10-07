-- 036: anomaly + pattern findings over order history (case PDF 6.5).
-- Rule/statistics-based findings with plain-language recommendations.
-- Every row is a SIGNAL for analysis, not a proven pattern; synthetic demo data carries planted patterns.
create or replace function public.anomaly_report(since timestamptz, until timestamptz)
returns table(kind text, subject text, facts text, recommendation text, weight numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(current_actor_role(),'') not in ('master','leader','admin') then raise exception 'master/leader role required'; end if;
  -- 1. Top problem equipment: most unplanned orders + repeated fault code concentration
  return query
  with u as (
    select o.equipment_id, e.name eq, s.name sec, count(*) n,
      sum(extract(epoch from (o.closed_at-o.created_at))/3600.0) down_h
    from orders o join equipment e on e.id=o.equipment_id join sections s on s.id=e.section_id
    where o.kind='unplanned' and o.created_at>=since and o.created_at<until and o.status='closed'
    group by 1,2,3 having count(*)>=4
  ), fc as (
    select o.equipment_id, o.closure->>'fault_code' code, count(*) n
    from orders o where o.kind='unplanned' and o.created_at>=since and o.created_at<until
      and o.status='closed' and jsonb_typeof(o.closure)='object' and o.closure->>'fault_code' is not null
    group by 1,2
  ), topfc as (
    select distinct on (equipment_id) equipment_id, code, n from fc order by equipment_id, n desc
  )
  select 'top_equipment', u.eq||' ('||u.sec||')',
    u.n||' внеплановых нарядов за период, суммарный простой ~'||round(u.down_h)||' ч'
      ||case when t.n>=2 then ', из них '||t.n||' с шифром '||t.code else '' end,
    case when t.n>=3 then 'Повторяющийся шифр '||t.code||': возможный сигнал нерешённой причины. Проверить корневую причину и рассмотреть включение в план ППР.'
      else 'Частые внеплановые остановки. Проверить условия эксплуатации и план ППР.' end,
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
  where o.status='closed' and o.created_at>=since and o.created_at<until and jsonb_typeof(o.closure)='object' and o.closure->>'fault_code' is not null
  group by o.equipment_id, e.name, s.name, (o.closure->>'fault_code') having count(*)>=4
  order by 5 desc limit 5;

  -- 3. Failure soon after planned maintenance: each failure linked to its CLOSEST prior PM, counted once
  return query
  with f as (
    select o.id, o.equipment_id,
      (select max(pm.closed_at) from orders pm where pm.equipment_id=o.equipment_id and pm.kind='planned'
        and pm.status='closed' and pm.closed_at<o.created_at and pm.closed_at>=since) pm_at
    from orders o
    where o.kind='unplanned' and o.status='closed' and o.created_at>=since and o.created_at<until
  )
  select 'post_pm_failure', e.name||' ('||s.name||')',
    count(*)||' внеплановых поломки/поломок в течение 7 дней после ближайшего предшествующего ППР',
    'Возможный сигнал о качестве ППР (не доказательство). Проверить полноту плановых работ и контроль после ремонта.',
    count(*)::numeric
  from f join equipment e on e.id=f.equipment_id join sections s on s.id=e.section_id
  where f.pm_at is not null and f.pm_at>=f.pm_at-interval '0 days' and exists (select 1)
    and (select 1 from orders o3 where o3.id=f.id and o3.created_at<=f.pm_at+interval '7 days') is not null
  group by e.name, s.name having count(*)>=2
  order by 5 desc limit 5;

  -- 4. Anomalous material consumption vs average for same material
  return query
  with m as (
    select o.id oid, e.name eq, (x->>'name') mat, (x->>'quantity')::numeric qty
    from orders o join equipment e on e.id=o.equipment_id,
      lateral jsonb_array_elements(case when jsonb_typeof(o.closure->'materials')='array' then o.closure->'materials' else '[]'::jsonb end) x
    where o.status='closed' and o.created_at>=since and o.created_at<until
  ), agg as (
    select mat, avg(qty) av, stddev_pop(qty) sd from m group by 1 having count(*)>=5
  )
  select 'material_outlier', m2.eq,
    'материал «'||m2.mat||'»: списано '||m2.qty||' при среднем '||round(a.av,1)||' по '||'демо-истории',
    'Отклонение от обычного расхода. Проверить обоснованность списания.',
    (m2.qty-a.av)
  from m m2 join agg a on a.mat=m2.mat
  where a.sd>0 and m2.qty>a.av+2*a.sd
  order by 5 desc limit 5;
end $$;
revoke all on function public.anomaly_report(timestamptz,timestamptz) from public;
grant execute on function public.anomaly_report(timestamptz,timestamptz) to authenticated;
select pg_notify('pgrst','reload schema');
