-- Stage 2: expose closure materials to the shift report.
create or replace view order_report with(security_invoker=true) as
 select o.id,o.title,o.status,o.kind,o.priority,o.created_at,o.closed_at,o.deadline,o.assignee_id,o.equipment_id,e.name equipment,s.name section,
 extract(epoch from coalesce(o.closed_at,now())-coalesce(o.started_at,o.created_at))/60 duration_minutes,
 (o.closed_at is not null and o.closed_at<=o.deadline) on_time,
 exists(select 1 from order_events ev where ev.order_id=o.id and ev.new_status='rework') had_rework,
 (o.ai_result->>'score')::numeric quality_score,
 o.closure->>'fault_code' fault_code,
 o.closure->'materials' materials
 from orders o join equipment e on e.id=o.equipment_id join sections s on s.id=e.section_id;
grant select on order_report to naryad_app;
