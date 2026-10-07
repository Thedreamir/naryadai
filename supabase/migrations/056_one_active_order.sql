-- Staged. Do not silently pick/cancel existing duplicates; preflight fails for a human decision.
do $$begin if exists(select 1 from public.orders where status='in_progress' and not cancelled group by assignee_id having count(*)>1) then raise exception 'existing concurrent active orders require reconciliation';end if;end $$;
create unique index if not exists one_active_order_per_worker on public.orders(assignee_id) where status='in_progress' and not cancelled;
