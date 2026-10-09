-- 023: Web Push (VAPID). Subscriptions are private to their owner; a pg_net trigger
-- on new orders asks the send-push edge function to notify the assignee.
create extension if not exists pg_net;
create table if not exists public.push_subscriptions(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.employees(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now());
alter table public.push_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='push_subscriptions' and policyname='push_subs_owner') then
    create policy push_subs_owner on public.push_subscriptions for all to authenticated
      using (user_id=auth.uid()) with check (user_id=auth.uid());
  end if;
end $$;
grant select,insert,delete on public.push_subscriptions to authenticated;

create or replace function public.notify_order_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare secret text:=current_setting('app.push_secret',true);
begin
  if secret is null or secret='' then return NEW; end if;
  perform net.http_post(
    url:=current_setting('app.push_url',true),
    headers:=jsonb_build_object('Content-Type','application/json','X-Push-Secret',secret),
    body:=jsonb_build_object('order_id',NEW.id,'kind',TG_ARGV[0]));
  return NEW;
end $$;
drop trigger if exists orders_push on public.orders;
create trigger orders_push after insert on public.orders
  for each row execute function public.notify_order_push('new_order');
