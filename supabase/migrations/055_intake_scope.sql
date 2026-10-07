-- Staged: scope metadata like orders. No public worker access to another order's photos.
drop policy if exists intake_read on public.order_intake_photos;
create policy intake_read on public.order_intake_photos for select to authenticated using (
 exists(select 1 from public.employees e where e.id=auth.uid() and e.is_active)
 and exists(select 1 from public.orders o where o.id=order_id and (o.assignee_id=auth.uid() or o.master_id=auth.uid() or current_actor_role() in ('master','leader','admin')))
);
