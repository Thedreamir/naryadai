-- 031: intake photos live in their own table (030's jsonb-on-orders approach hit the
-- status-transition trigger on orders updates).
drop function if exists public.record_intake_photo(int,text,text,int,text,timestamptz);
alter table public.orders drop column if exists intake_photos;
create table if not exists public.order_intake_photos (
  id bigint generated always as identity primary key,
  order_id int not null references public.orders(id) on delete cascade,
  uploaded_by uuid not null,
  storage_path text not null,
  sha256 text not null,
  byte_size int not null,
  mime_type text not null,
  phase text not null default 'before_intake',
  captured_client_at timestamptz,
  server_received_at timestamptz not null default now()
);
alter table public.order_intake_photos enable row level security;
create policy intake_read on public.order_intake_photos for select to authenticated using (true);
create policy intake_insert on public.order_intake_photos for insert to authenticated with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.orders o where o.id = order_id
    and o.assignee_id = auth.uid()
    and o.status in ('accepted','in_progress','rework','paused'))
);
comment on table public.order_intake_photos is 'Before-photos captured at intake, before work starts. Insert-only before completion; closure displays these read-only.';
grant select, insert on public.order_intake_photos to authenticated;
grant select on public.order_intake_photos to service_role;
