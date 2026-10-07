-- 029: knowledge_docs — curated synthetic equipment documentation for the worker assistant.
-- Only master/admin can write; every authenticated employee can read (assistant reads via Edge Function anyway).
create table if not exists public.knowledge_docs (
  id bigint generated always as identity primary key,
  equipment_id bigint references public.equipment(id) on delete set null,
  title text not null,
  body text not null,
  source_label text not null default 'Синтетический документ (демо)',
  created_at timestamptz not null default now()
);
alter table public.knowledge_docs enable row level security;
create policy knowledge_docs_read on public.knowledge_docs for select to authenticated using (true);
create policy knowledge_docs_write on public.knowledge_docs for insert to authenticated
  with check (exists (select 1 from public.employees e where e.id = auth.uid() and e.role in ('master','admin')));
create policy knowledge_docs_update on public.knowledge_docs for update to authenticated
  using (exists (select 1 from public.employees e where e.id = auth.uid() and e.role in ('master','admin')));
comment on table public.knowledge_docs is 'Curated equipment knowledge for the worker assistant. Demo content is synthetic; assistant must answer only from these docs + order context, otherwise say unavailable.';
grant select on public.knowledge_docs to authenticated, service_role;
grant insert, update on public.knowledge_docs to service_role;
