-- 044: governed repair memory. Candidate field notes are NOT normative instructions;
-- entries become reusable only after explicit master/admin approval; revocation removes from retrieval.
create table if not exists public.repair_memory (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id),
  equipment_id bigint references public.equipment(id),
  title text not null check (length(trim(title))>=5),
  body text not null check (length(trim(body))>=20),
  author_id uuid not null references public.employees(id),
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','revoked')),
  version integer not null default 1,
  reviewed_by uuid references public.employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
alter table public.repair_memory enable row level security;
-- read: approved entries visible to every authenticated employee (retrieval);
-- candidates/own drafts visible to author and to master/leader/admin review surfaces.
create policy repair_memory_read on public.repair_memory for select to authenticated using (
  status='approved'
  or author_id=current_actor()
  or current_actor_role() in ('master','leader','admin')
);
grant select on public.repair_memory to authenticated;
grant all on public.repair_memory to service_role;

-- propose: worker may attach a note only to an own order with real work content (completed/closed);
-- master/admin may propose on any completed/closed order. Note starts as candidate.
create or replace function public.propose_repair_memory(p_order_id bigint, p_title text, p_body text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=current_actor_role(); me uuid:=current_actor(); o orders%rowtype;
begin
  if me is null or r is null then raise exception 'actor required'; end if;
  select * into o from orders where id=p_order_id;
  if not found then raise exception 'order unavailable'; end if;
  if o.status not in ('completed','ai_review','closed') then raise exception 'memory only from executed work'; end if;
  if r='worker' and o.assignee_id<>me then raise exception 'own order required'; end if;
  if r not in ('worker','master','admin') then raise exception 'worker or master required'; end if;
  insert into repair_memory(order_id,equipment_id,title,body,author_id)
    values(p_order_id,o.equipment_id,trim(p_title),trim(p_body),me) returning id into o.id;
  return o.id;
end $$;

-- review: master/admin approves (reusable), rejects, or revokes. Candidate notes never auto-approve,
-- a 5/5 closure score is not an approval. Rejection/revocation keep the record for audit.
create or replace function public.review_repair_memory(p_id bigint, p_action text, p_note text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cur text;
begin
  if coalesce(current_actor_role(),'') not in ('master','admin') then raise exception 'master action required'; end if;
  select status into cur from repair_memory where id=p_id for update;
  if not found then raise exception 'entry unavailable'; end if;
  if p_action='approve' then
    if cur<>'candidate' then raise exception 'only candidate can be approved'; end if;
    update repair_memory set status='approved',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id;
  elsif p_action='reject' then
    if cur<>'candidate' then raise exception 'only candidate can be rejected'; end if;
    update repair_memory set status='rejected',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id;
  elsif p_action='revoke' then
    if cur<>'approved' then raise exception 'only approved can be revoked'; end if;
    update repair_memory set status='revoked',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id;
  else raise exception 'unknown action'; end if;
end $$;

-- author edits own candidate only; edit bumps version and keeps it candidate (needs fresh review).
create or replace function public.update_repair_memory(p_id bigint, p_title text, p_body text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_actor() is null then raise exception 'actor required'; end if;
  update repair_memory set title=trim(p_title), body=trim(p_body), version=version+1
  where id=p_id and author_id=current_actor() and status='candidate';
  if not found then raise exception 'editable candidate not found'; end if;
end $$;

revoke all on function public.propose_repair_memory(bigint,text,text) from public,anon;
grant execute on function public.propose_repair_memory(bigint,text,text) to authenticated;
revoke all on function public.review_repair_memory(bigint,text,text) from public,anon;
grant execute on function public.review_repair_memory(bigint,text,text) to authenticated;
revoke all on function public.update_repair_memory(bigint,text,text) from public,anon;
grant execute on function public.update_repair_memory(bigint,text,text) to authenticated;
select pg_notify('pgrst','reload schema');
