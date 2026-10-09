-- Restores previous, wider policies. Incident rollback only; not a security fix.
begin;
drop policy if exists l6_declaration_order_scope on public.order_declarations;
drop policy if exists l6_active_order_actor on public.orders;
commit;
