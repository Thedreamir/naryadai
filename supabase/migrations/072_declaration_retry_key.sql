-- Immutable retry dedupe. Existing evidence stays unchanged and retains timestamps.
-- A new order version gets a new key, preserving a later safety declaration.
begin;
alter table public.order_declarations add column if not exists declarations_idempotency_key text;
create unique index if not exists declarations_retry_key on public.order_declarations(declarations_idempotency_key);
commit;
