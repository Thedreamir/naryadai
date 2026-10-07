-- 035: RLS read-only on reference tables; five-factor worker rating with explanation.
-- Reference data (sections, equipment, employees, fault_codes, materials, crews):
-- readable by any authenticated session, writable only by service role (no client write policies).
alter table public.sections enable row level security;
alter table public.equipment enable row level security;
alter table public.employees enable row level security;
alter table public.fault_codes enable row level security;
alter table public.materials enable row level security;
alter table public.crews enable row level security;
create policy sections_read on public.sections for select to authenticated using (true);
create policy equipment_read on public.equipment for select to authenticated using (true);
create policy employees_read on public.employees for select to authenticated using (true);
create policy fault_codes_read on public.fault_codes for select to authenticated using (true);
create policy materials_read on public.materials for select to authenticated using (true);
create policy crews_read on public.crews for select to authenticated using (true);

-- Five-factor rating (case PDF 6.6). Weights chosen by team, justified on defense:
-- quality 30, on-time 25, no-rework 20, volume/complexity 15, no-unjustified-rejects 10.
-- Quality factor uses master's human_score only (AI verdicts are advisory, not scores).
-- When a factor has no data it is excluded and weights renormalize; explanation says so.
create or replace function public.worker_rating(since timestamptz, until timestamptz)
returns table(worker_id uuid, name text, closed bigint, on_time bigint, rework bigint,
  complexity bigint, rejects bigint, quality_avg numeric, quality_n bigint,
  f_quality numeric, f_ontime numeric, f_rework numeric, f_volume numeric, f_rejects numeric,
  total numeric, factors_available int, explanation text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare maxc bigint;
begin
  select greatest(1, sum(case o.priority when 'emergency' then 3 when 'high' then 2 else 1 end))
    into maxc
    from orders o where o.status='closed' and o.closed_at >= since and o.closed_at < until
    group by o.assignee_id order by 1 desc limit 1;
  maxc := coalesce(maxc, 1);
  return query
  with cl as (
    select o.* from orders o where o.status='closed' and o.closed_at >= since and o.closed_at < until
  ), rw as (
    -- factor 3: rework event OR repeat failure on same equipment within 7 days; each closed order counted once
    select c.id from cl c
    where exists (select 1 from order_events e where e.order_id=c.id and e.new_status='rework')
       or exists (select 1 from orders o2 where o2.equipment_id=c.equipment_id and o2.id<>c.id
                  and o2.kind='unplanned' and o2.created_at>c.closed_at and o2.created_at<=c.closed_at+interval '7 days')
  ), base as (
    select c.assignee_id wid,
      count(*) c,
      count(*) filter (where c.closed_at <= c.deadline) ot,
      count(*) filter (where c.id in (select id from rw)) rw,
      sum(case c.priority when 'emergency' then 3 when 'high' then 2 else 1 end) cx,
      avg(nullif(c.ai_result->>'human_score','')::numeric) qavg,
      count(nullif(c.ai_result->>'human_score','')) qn
    from cl c
    group by c.assignee_id
  ), rej as (
    -- factor 5: refusals WITHOUT a valid reason only. Valid reasons (PDF 5.3.2): no materials/parts, no permit, busy with emergency.
    select e.actor_id wid, count(*) rj from order_events e
    join orders o2 on o2.id=e.order_id
    where e.new_status='rejected' and e.created_at >= since and e.created_at < until
      and o2.assignee_id=e.actor_id
      and coalesce(e.reason,'') !~* '(материал|запчаст|допуск|авари|занят|нет доступа|не моя|специальност)'
    group by e.actor_id
  )
  select b.wid, emp.name, b.c, b.ot, b.rw, b.cx, coalesce(r.rj,0), round(b.qavg,2), b.qn,
    case when b.qn>0 then round(b.qavg/5*100,1) end,
    round(b.ot::numeric/b.c*100,1),
    round((1-b.rw::numeric/b.c)*100,1),
    round(b.cx::numeric/maxc*100,1),
    greatest(0,100-coalesce(r.rj,0)*25)::numeric,
    round((
      coalesce(case when b.qn>0 then b.qavg/5*100 end,0)*case when b.qn>0 then 30 else 0 end
      + b.ot::numeric/b.c*100*25
      + (1-b.rw::numeric/b.c)*100*20
      + b.cx::numeric/maxc*100*15
      + greatest(0,100-coalesce(r.rj,0)*25)*10
    )/(case when b.qn>0 then 100 else 70 end),1),
    case when b.qn>0 then 5 else 4 end,
    'Закрыто '||b.c||'; в срок '||round(b.ot::numeric/b.c*100)||'% ('||b.ot||'/'||b.c||'); доработки или повторы за 7 дн: '
      ||b.rw||'; баллы сложности '||b.cx||' (аварийный=3, высокий=2, обычный/плановый=1); отказов без уважительной причины: '
      ||coalesce(r.rj,0)||case when b.qn>0 then '; качество '||round(b.qavg,1)||'/5 по '||b.qn||' оценкам мастера'
      else '; оценок качества нет — фактор исключён, веса перенормированы (4/5)' end
  from base b
  join employees emp on emp.id=b.wid
  left join rej r on r.wid=b.wid
  order by 15 desc nulls last;
end $$;
revoke all on function public.worker_rating(timestamptz,timestamptz) from public;
grant execute on function public.worker_rating(timestamptz,timestamptz) to authenticated;
select pg_notify('pgrst','reload schema');
-- service_role needs explicit table grants once RLS is on (employee upserts via admin API)
grant select, insert, update, delete on public.sections to service_role;
grant select, insert, update, delete on public.equipment to service_role;
grant select, insert, update, delete on public.employees to service_role;
grant select, insert, update, delete on public.fault_codes to service_role;
grant select, insert, update, delete on public.materials to service_role;
grant select, insert, update, delete on public.crews to service_role;
