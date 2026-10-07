-- 052 employee_permits: synthetic permit records for explainable dispatch (case 5.1.3).
create table if not exists employee_permits (
  id bigint generated always as identity primary key,
  employee_id uuid not null references employees(id) on delete cascade,
  permit text not null,
  valid_until date not null,
  synthetic boolean not null default true
);
alter table employee_permits enable row level security;
create policy employee_permits_read on employee_permits for select to authenticated using (true);

insert into employee_permits (employee_id, permit, valid_until)
select e.id, p.permit, p.valid_until from employees e
join (values
  ('Ахметов Ержан','Электробезопасность III','2027-03-01'::date),
  ('Ахметов Ержан','Огневые работы','2027-01-15'::date),
  ('Бериков Сейтек','Электробезопасность IV','2027-06-01'::date),
  ('Смаилов Даурен','Огневые работы','2026-11-20'::date),
  ('Кусаинов Ерлан','Электробезопасность III','2027-02-10'::date),
  ('Оспанов Марат','Работы на высоте','2027-04-01'::date),
  ('Сейтов Нуржан','Электробезопасность V','2027-08-01'::date),
  ('Жумабеков Айбек','Электробезопасность III','2026-10-05'::date),
  ('Тлеубеков Нурлан','Огневые работы','2027-05-12'::date),
  ('Абдрахманов Серик','Электробезопасность IV','2027-01-30'::date),
  ('Ермеков Жандос','Работы на высоте','2027-03-22'::date),
  ('Галиев Тимур','Электробезопасность III','2027-07-07'::date),
  ('Ибраев Руслан','Огневые работы','2027-02-18'::date),
  ('Калиев Арман','Электробезопасность IV','2026-12-01'::date),
  ('Нургожин Болат','Сосуды под давлением','2027-09-09'::date),
  ('Сарсенов Кайрат','Электробезопасность III','2027-04-27'::date)
) as p(name,permit,valid_until) on p.name=e.name;
grant select on employee_permits to authenticated;
