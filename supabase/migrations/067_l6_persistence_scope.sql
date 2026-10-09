-- L6 local candidate. No live apply. Requires hosted adapter + migrations 032,039.
-- Restrictive policies intersect existing permissive policies, never widen access.
-- Keep service_role outside these policy targets for verified backend work.
begin;
drop policy if exists l6_active_order_actor on public.orders;
create policy l6_active_order_actor on public.orders as restrictive
for all to authenticated,naryad_app
using (exists(select 1 from public.employees e where e.id=(select current_actor()) and e.is_active))
with check (exists(select 1 from public.employees e where e.id=(select current_actor()) and e.is_active));

-- A declaration contains worker safety evidence and is not a global reference list.
-- Parent order visibility provides the same worker/master/leader audience as orders.
drop policy if exists l6_declaration_order_scope on public.order_declarations;
create policy l6_declaration_order_scope on public.order_declarations as restrictive
for all to authenticated
using (exists(select 1 from public.orders o where o.id=order_id))
with check (exists(select 1 from public.orders o where o.id=order_id));
commit;
