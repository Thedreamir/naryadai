-- Run 2 of 3. RLS was already enabled in chunk 1 to prevent an exposure window.
BEGIN;
DO $$ BEGIN IF (SELECT phase FROM public.tekton_notify_release_backup)<>1 THEN RAISE EXCEPTION 'Wrong release phase; STOP'; END IF; END $$;
CREATE INDEX telegram_pair_employee_recent ON public.telegram_pair_requests(employee_id,created_at DESC);
CREATE INDEX telegram_delivery_state ON public.telegram_deliveries(state,claimed_at);
alter table telegram_pair_requests enable row level security;
alter table telegram_connections enable row level security;
alter table telegram_updates enable row level security;
alter table telegram_deliveries enable row level security;
revoke all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries from anon,authenticated;
grant all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries to service_role;
UPDATE public.tekton_notify_release_backup SET phase=2;
COMMIT;
SELECT phase FROM public.tekton_notify_release_backup;
