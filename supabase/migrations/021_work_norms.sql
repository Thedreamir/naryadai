-- 021: demo work-time norms reference for the executor report. Honestly labelled
-- "демо-справочник": values are invented for the demo, not measured in production.
create table if not exists public.work_norms(
  work_type text primary key,
  norm_minutes integer not null check (norm_minutes>0),
  note text not null default 'демо-справочник');
alter table public.work_norms enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='work_norms' and policyname='work_norms_read') then
    create policy work_norms_read on public.work_norms for select to authenticated using (true);
  end if;
end $$;
grant select on public.work_norms to authenticated;
insert into public.work_norms(work_type,norm_minutes) values
  ('замена кабеля',60),('заменить кабель',60),('кабель',60),
  ('подшипник',90),('смазк',30),('осмотр',20),
  ('замер',25),('сопротивлен',25),('ремень',45),
  ('масл',40),('диагностика',30),('вибраци',25),('датчик',35)
on conflict (work_type) do nothing;
