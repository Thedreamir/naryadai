-- 026: grants for the push pipeline (service_role reads for send-push; authenticated upsert).
grant select on public.orders to service_role;
grant select on public.employees to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant update on public.push_subscriptions to authenticated;
