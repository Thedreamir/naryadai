-- 032: order_declarations — worker safety declarations recorded at the moment they apply.
-- pre_work declarations are captured when starting work (accepted -> in_progress), not at surrender.
create table if not exists public.order_declarations (
  id bigint generated always as identity primary key,
  order_id int not null references public.orders(id) on delete cascade,
  declared_by uuid not null,
  phase text not null,
  text text not null,
  confirmed boolean not null default true,
  declared_at timestamptz not null default now()
);
alter table public.order_declarations enable row level security;
create policy declarations_read on public.order_declarations for select to authenticated using (true);
create policy declarations_insert on public.order_declarations for insert to authenticated with check (
  declared_by = auth.uid()
  and exists (select 1 from public.orders o where o.id = order_id
    and o.assignee_id = auth.uid()
    and o.status in ('accepted','in_progress','rework','paused'))
);
comment on table public.order_declarations is 'Worker declarations with server time. pre_work rows belong at work start; late rows must be labeled as made at surrender.';
grant select, insert on public.order_declarations to authenticated;
grant select on public.order_declarations to service_role;
select pg_notify('pgrst','reload schema');
