-- Proposed local hardening. NOT a deployed or numbered migration.
-- Merge owner: lane 6. Review against current policies/grants before adoption.
-- Relies on migration 039 current_actor_role() filtering inactive employees.
begin;
drop policy if exists read_orders on public.orders;
create policy read_orders on public.orders for select to naryad_app using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and (assignee_id=(select current_actor()) or (select current_actor_role()) in ('master','leader','admin'))
);
drop policy if exists update_orders on public.orders;
create policy update_orders on public.orders for update to naryad_app using (
 (coalesce((select current_actor_role()),'')='worker' and assignee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','admin')
) with check (
 (coalesce((select current_actor_role()),'')='worker' and assignee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','admin')
);
drop policy if exists read_notifications on public.notifications;
create policy read_notifications on public.notifications for select to naryad_app using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and recipient_id=(select current_actor())
);
drop policy if exists declarations_read on public.order_declarations;
create policy declarations_read on public.order_declarations for select to authenticated using (
 coalesce((select current_actor_role()),'') in ('worker','master','leader','admin')
 and exists(select 1 from public.orders o where o.id=order_id)
);
drop policy if exists declarations_insert on public.order_declarations;
create policy declarations_insert on public.order_declarations for insert to authenticated with check (
 coalesce((select current_actor_role()),'')='worker'
 and declared_by=(select current_actor())
 and exists(select 1 from public.orders o where o.id=order_id and o.assignee_id=(select current_actor()) and o.status in ('accepted','in_progress','rework','paused'))
);
drop policy if exists employee_permits_read on public.employee_permits;
create policy employee_permits_read on public.employee_permits for select to authenticated using (
 (coalesce((select current_actor_role()),'')='worker' and employee_id=(select current_actor()))
 or (select current_actor_role()) in ('master','leader','admin')
);
commit;
