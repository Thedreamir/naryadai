-- НарядAI demo reset (hosted). One step: wipe order-domain data and re-seed the
-- deterministic synthetic history (same pattern as scripts/history-seed.mjs, seed 42).
-- Employees/equipment/reference data are kept, except the service demo worker-c.
-- Apply via Management API as postgres (triggers disabled during reseed).
begin;
delete from notifications;
delete from order_photos;
delete from order_events;
delete from ai_cache;
delete from orders;
delete from employees where email='worker-c@naryadai.test';
alter table orders disable trigger user;
alter table order_events disable trigger user;
with w as (select id, row_number() over (order by name)-1 rn, count(*) over() n from employees where role='worker'),
     m as (select id from employees where role='master' order by created_at limit 1),
     s as (select i from generate_series(0,519) i),
     ins as (
  insert into orders(title,kind,equipment_id,assignee_id,master_id,priority,status,deadline,created_at,started_at,closed_at,closure,ai_result)
  select
    'СИНТЕТИКА · обслуживание №'||(i+1),
    case when i%31=0 or i%4<>0 then 'unplanned' else 'planned' end,
    case when i%19=0 then 1 when i%31=0 then 3 else (i%25)+1 end,
    (select id from w where rn = i % w.n),
    (select id from m),
    'normal','closed',
    now() - ((90-(i%90))||' days')::interval + ((i%16)*30||' minutes')::interval + '2 hours'::interval,
    now() - ((90-(i%90))||' days')::interval + ((i%16)*30||' minutes')::interval,
    now() - ((90-(i%90))||' days')::interval + ((i%16)*30||' minutes')::interval,
    now() - ((90-(i%90))||' days')::interval + ((i%16)*30||' minutes')::interval + ((45+(i%7)*20)||' minutes')::interval,
    jsonb_build_object('works', case when i%3=0 then 'Проверена цепь питания и заменён кабель' else 'Выполнено обслуживание узла и проверены крепления' end,
      'fault_code', case when i%19=0 then 'М-02' when i%3=0 then 'Э-01' else 'Г-01' end,
      'materials', jsonb_build_array(jsonb_build_object('name','Смазка','quantity', case when i%23=0 then 12 else 0.4+(i%4)*0.1 end)),
      'photos', '[]'::jsonb, 'synthetic', true),
    '{"mode":"synthetic_seed","verdict":"needs_master","score":null,"confidence":null,"reasons":["Сгенерированная история. Это не оценка модели."]}'::jsonb
  from s
  returning id, created_at, closed_at, (select id from m) as master_id)
insert into order_events(order_id,actor_id,new_status,created_at)
select id, master_id, 'issued', created_at from ins
union all
select id, master_id, 'closed', closed_at from ins;
alter table orders enable trigger user;
alter table order_events enable trigger user;
commit;
