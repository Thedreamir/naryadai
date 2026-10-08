-- AI order review archive (case «НарядAI» §6.4, entity «Оценка ИИ» из §8) + photo capture time.
create table if not exists ai_reviews(
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id),
  verdict text not null check(verdict in ('accepted','accepted_with_remarks','rework','needs_master_review')),
  score integer check(score between 1 and 5),          -- null => master decides (low confidence)
  confidence numeric check(confidence between 0 and 1),
  needs_master_review boolean not null default false,
  explanation text not null default '',                -- report_master text
  layer1 jsonb,                                        -- deterministic checks
  layer2 jsonb,                                        -- model results (work match, photo comparison)
  reasons jsonb,
  model text,                                          -- null => rules only
  prompt_version text,
  master_score integer check(master_score between 1 and 5),
  master_verdict text check(master_verdict in ('accepted','accepted_with_remarks','rework')),
  master_comment text,
  master_decided_by uuid references employees(id),
  master_decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_reviews_order_idx on ai_reviews(order_id);
alter table ai_reviews enable row level security;
drop policy if exists read_ai_reviews on ai_reviews;
create policy read_ai_reviews on ai_reviews for select to naryad_app
  using(exists(select 1 from orders where id=order_id));  -- same visibility as the order
-- Inserts come from the edge function with the service role; no write grant for the app role.
grant select on ai_reviews to naryad_app;
grant usage,select on all sequences in schema public to naryad_app;

-- Capture time for freshness checks (§6.3 п.1); uploaded client-side from EXIF when available.
alter table order_photos add column if not exists captured_at timestamptz;
-- Explicit photo role. REQUIRED for before-detection: the review uses only
-- kind='before' rows (plus orders.before_photos); the upload path must set it.
alter table order_photos add column if not exists kind text check(kind in ('before','after'));

-- Local-dev parity: the prod base already has work_norms; local migrations 001-006 did not.
create table if not exists work_norms(work_type text primary key, norm_minutes integer not null check(norm_minutes>0));
