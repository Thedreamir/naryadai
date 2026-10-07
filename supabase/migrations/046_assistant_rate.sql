-- 046: per-user assistant request journal for free-quota bounding
create table if not exists public.assistant_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  mode text not null default 'chat',
  created_at timestamptz not null default now()
);
alter table public.assistant_requests enable row level security;
-- no client read/write; edge function uses service role
grant all on public.assistant_requests to service_role;
create index if not exists assistant_requests_user_ts on public.assistant_requests(user_id, created_at desc);
select pg_notify('pgrst','reload schema');
