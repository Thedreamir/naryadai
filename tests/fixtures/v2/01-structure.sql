-- Run 1 of 3. Atomic, no outbound sends. Stop on any error.
BEGIN;
DO $preflight$
DECLARE t record;
BEGIN
 IF to_regclass('public.tekton_notify_release_backup') IS NOT NULL THEN RAISE EXCEPTION 'Release backup already exists. Do not rerun.'; END IF;
 IF to_regprocedure('public.check_deadlines(timestamptz)') IS NULL OR to_regprocedure('public.current_actor()') IS NULL THEN RAISE EXCEPTION 'Expected foundation absent'; END IF;
 IF to_regclass('public.telegram_connections') IS NOT NULL OR to_regclass('public.telegram_pair_requests') IS NOT NULL OR to_regclass('public.telegram_deliveries') IS NOT NULL OR to_regclass('public.telegram_updates') IS NOT NULL OR to_regprocedure('public.notify_new_order_durable()') IS NOT NULL THEN RAISE EXCEPTION 'Telegram/new-order foundation already exists. Reconcile manually.'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('telegram_pair_create','telegram_pending_bind','telegram_pair_status','telegram_pair_confirm','telegram_disconnect')) THEN RAISE EXCEPTION 'Pair RPC already exists'; END IF;
 FOR t IN SELECT tg.tgname,p.proname,pg_get_functiondef(p.oid) src FROM pg_trigger tg JOIN pg_proc p ON p.oid=tg.tgfoid WHERE tg.tgrelid='public.orders'::regclass AND NOT tg.tgisinternal AND (tg.tgtype & 4)=4 LOOP
   IF t.proname NOT IN ('audit_order_insert','notify_order_push') THEN RAISE EXCEPTION 'Unknown INSERT trigger: %, function %. STOP and inspect.',t.tgname,t.proname; END IF;
   IF t.proname='audit_order_insert' AND t.src ~* '(notifications|http_post|send.push)' THEN RAISE EXCEPTION 'Audit trigger also notifies; reconcile before install'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='notifications' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%order_id, recipient_id, kind, bucket%') THEN RAISE EXCEPTION 'Expected notification dedup unique index absent'; END IF;
END $preflight$;
CREATE TABLE public.tekton_notify_release_backup(function_def text NOT NULL,restore_acl text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.tekton_notify_release_backup FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO public.tekton_notify_release_backup(function_def,restore_acl)
SELECT pg_get_functiondef(p.oid),coalesce((SELECT string_agg('GRANT EXECUTE ON FUNCTION public.check_deadlines(timestamptz) TO '||CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END||CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END||';',E'\n') FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.privilege_type='EXECUTE'),'') FROM pg_proc p WHERE p.oid='public.check_deadlines(timestamptz)'::regprocedure;

create table public.telegram_pair_requests(id uuid primary key default gen_random_uuid(),employee_id uuid not null references employees(id),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),expires_at timestamptz not null check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),consumed_at timestamptz,pending_chat text,pending_telegram text,confirmed_at timestamptz,revoked_at timestamptz);
create table public.telegram_connections(employee_id uuid primary key references employees(id),chat_id text not null unique check(chat_id ~ '^[1-9][0-9]{0,15}$'),telegram_id text not null unique check(telegram_id=chat_id),confirmed_at timestamptz not null default now(),revoked_at timestamptz);
create table public.telegram_updates(update_id bigint primary key,received_at timestamptz not null default now());
create table public.telegram_deliveries(notification_id bigint not null references notifications(id),employee_id uuid not null references employees(id),state text not null check(state in ('claimed','sent','failed','unknown','cancelled')),claimed_at timestamptz not null default now(),finished_at timestamptz,message_id text,primary key(notification_id,employee_id));
alter table telegram_pair_requests enable row level security;
alter table telegram_connections enable row level security;
alter table telegram_updates enable row level security;
alter table telegram_deliveries enable row level security;
revoke all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries from anon,authenticated;
grant all on telegram_pair_requests,telegram_connections,telegram_updates,telegram_deliveries to service_role;
ALTER TABLE public.tekton_notify_release_backup ADD COLUMN phase integer NOT NULL DEFAULT 1;
COMMIT;
SELECT phase FROM public.tekton_notify_release_backup;
