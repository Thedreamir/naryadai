-- 037: materials consumption + equipment downtime reports (case PDF §7, "желательно").
create or replace function public.materials_report(since timestamptz, until timestamptz)
returns table(material text, total_qty numeric, uses bigint, sections text[], avg_qty numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(current_actor_role(),'') not in ('master','leader','admin') then raise exception 'master/leader role required'; end if;
  return query
  with m as (
    select (x->>'name') mat, (x->>'quantity')::numeric qty, s.name sec
    from orders o join equipment e on e.id=o.equipment_id join sections s on s.id=e.section_id,
      lateral jsonb_array_elements(case when jsonb_typeof(o.closure->'materials')='array' then o.closure->'materials' else '[]'::jsonb end) x
    where o.status='closed' and o.closed_at>=since and o.closed_at<until
  )
  select mat, sum(qty), count(*), array_agg(distinct sec), round(avg(qty),2) from m group by mat order by 2 desc;
end $$;
create or replace function public.downtime_report(since timestamptz, until timestamptz)
returns table(equipment text, section text, unplanned bigint, planned bigint,
  order_lifetime_hours numeric, top_fault text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(current_actor_role(),'') not in ('master','leader','admin') then raise exception 'master/leader role required'; end if;
  return query
  with o as (
    select o2.equipment_id, o2.kind, o2.created_at, o2.closed_at, (o2.closure->>'fault_code') fc
    from orders o2 where o2.status='closed' and o2.closed_at>=since and o2.closed_at<until
  ), agg as (
    select equipment_id,
      count(*) filter (where kind='unplanned') u,
      count(*) filter (where kind='planned') p,
      round(sum(extract(epoch from (closed_at-created_at))/3600.0)::numeric,1) dh
    from o group by 1
  ), tf as (
    select distinct on (equipment_id) equipment_id, fc from o where fc is not null
    group by equipment_id, fc order by equipment_id, count(*) desc
  )
  select e.name, s.name, a.u, a.p, a.dh, tf.fc
  from agg a join equipment e on e.id=a.equipment_id join sections s on s.id=e.section_id
  left join tf on tf.equipment_id=a.equipment_id
  where a.u>0 order by a.dh desc;
end $$;
revoke all on function public.materials_report(timestamptz,timestamptz) from public;
revoke all on function public.downtime_report(timestamptz,timestamptz) from public;
grant execute on function public.materials_report(timestamptz,timestamptz) to authenticated;
grant execute on function public.downtime_report(timestamptz,timestamptz) to authenticated;
select pg_notify('pgrst','reload schema');
