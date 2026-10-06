create or replace view employee_ratings with(security_invoker=true) as
with facts as (
select o.*,exists(select 1 from orders newer where newer.equipment_id=o.equipment_id and newer.closure->>'fault_code'=o.closure->>'fault_code' and newer.created_at>o.closed_at and newer.created_at<=o.closed_at+interval '7 days') repeat_7d,
case when jsonb_typeof(o.ai_result->'human_score')='number' then (o.ai_result->>'human_score')::numeric else null end human_score,
exists(select 1 from order_events ev where ev.order_id=o.id and ev.new_status='rework') reworked
from orders o
), summary as (
select assignee_id,count(*) filter(where status='closed') closed,count(*) filter(where status='closed' and closed_at<=deadline) timely,
count(*) filter(where status='closed' and (reworked or repeat_7d)) returned_or_repeated,
count(*) filter(where status='rejected') rejected,
count(human_score) filter(where status='closed') quality_count,
avg(human_score) filter(where status='closed') quality_average,
sum(case priority when 'emergency' then 3 when 'high' then 2 else 1 end) filter(where status='closed') weighted_volume
from facts group by assignee_id
)
select e.id,e.name,coalesce(s.closed,0) closed,coalesce(s.timely,0) timely,coalesce(s.returned_or_repeated,0) returned_or_repeated,coalesce(s.rejected,0) rejected,s.quality_average,coalesce(s.weighted_volume,0) weighted_volume,
case when s.closed>0 and s.quality_average is not null and s.quality_count=s.closed then round(40*s.quality_average/5+25*s.timely::numeric/s.closed+20*(1-s.returned_or_repeated::numeric/s.closed)+10*least(1,s.weighted_volume::numeric/50)+5*(1-least(1,s.rejected::numeric/greatest(1,s.closed+s.rejected))),1) else null end full_score
from employees e left join summary s on s.assignee_id=e.id where e.role='worker';
grant select on employee_ratings to naryad_app;
