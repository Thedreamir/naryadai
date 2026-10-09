-- LOCAL ONLY. Approved status alone is never a worker extraction permit.
begin;
alter table public.knowledge_docs add column if not exists content_domain text not null default 'unclassified',add column if not exists safety_sensitive boolean not null default true,add column if not exists worker_extract_eligible boolean not null default false;
alter table public.repair_memory add column if not exists content_domain text not null default 'unclassified',add column if not exists safety_sensitive boolean not null default true,add column if not exists worker_extract_eligible boolean not null default false;
-- No blanket backfill. A human reviews each source's domain/eligibility separately.
commit;
