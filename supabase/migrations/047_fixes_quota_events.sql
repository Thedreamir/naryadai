-- 047: (1) reject audit event name fix, (2) atomic per-user quota RPC, (3) append-only journal trigger, (4) author sees master decisions on own notes
create or replace function public.review_repair_memory(p_id bigint, p_action text, p_note text, p_expected_version integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cur text; curv integer; ev text;
begin
  if coalesce(current_actor_role(),'') not in ('master','admin') then raise exception 'master action required'; end if;
  select status,version into cur,curv from repair_memory where id=p_id for update;
  if not found then raise exception 'entry unavailable'; end if;
  if curv<>p_expected_version then raise exception 'version changed; re-read before review'; end if;
  if p_action='approve' then
    if cur<>'candidate' then raise exception 'only candidate can be approved'; end if;
    update repair_memory set status='approved',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id; ev:='approved';
  elsif p_action='reject' then
    if cur<>'candidate' then raise exception 'only candidate can be rejected'; end if;
    update repair_memory set status='rejected',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id; ev:='rejected';
  elsif p_action='revoke' then
    if cur<>'approved' then raise exception 'only approved can be revoked'; end if;
    update repair_memory set status='revoked',reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id; ev:='revoked';
  else raise exception 'unknown action'; end if;
  insert into repair_memory_events(memory_id,event,actor_id,note,version,title,body)
    select p_id,ev,current_actor(),p_note,version,title,body from repair_memory where id=p_id;
end $$;
revoke all on function public.review_repair_memory(bigint,text,text,integer) from public,anon;
grant execute on function public.review_repair_memory(bigint,text,text,integer) to authenticated;

-- append-only: no UPDATE/DELETE on the journal, for any role (incl. owner/service_role) except via TRUNCATE by DB admin
create or replace function public.repair_memory_events_immutable() returns trigger language plpgsql as $$
begin raise exception 'repair_memory_events is append-only'; end $$;
drop trigger if exists repair_memory_events_no_change on public.repair_memory_events;
create trigger repair_memory_events_no_change before update or delete on public.repair_memory_events
  for each row execute function public.repair_memory_events_immutable();

-- author sees every event on own notes (incl. master decisions)
drop policy if exists repair_memory_events_read on public.repair_memory_events;
create policy repair_memory_events_read on public.repair_memory_events for select to authenticated using (
  exists(select 1 from public.employees e where e.id=current_actor() and e.is_active)
  and (actor_id=current_actor()
       or current_actor_role() in ('master','leader','admin')
       or exists(select 1 from public.repair_memory m where m.id=memory_id and m.author_id=current_actor()))
);

-- atomic quota: one transaction, per-user advisory lock, prune >1 day, check then insert; fail-closed
create or replace function public.assistant_quota_take(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,47));
  delete from assistant_requests where created_at < now()-interval '1 day';
  select count(*) into n from assistant_requests where user_id=p_user and created_at>=now()-interval '1 hour';
  if n>=p_limit then return false; end if;
  insert into assistant_requests(user_id) values (p_user);
  return true;
end $$;
revoke all on function public.assistant_quota_take(uuid,integer) from public,anon,authenticated;
grant execute on function public.assistant_quota_take(uuid,integer) to service_role;
select pg_notify('pgrst','reload schema');
