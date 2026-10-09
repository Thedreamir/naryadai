-- L5 staged hardening. Apply only after 050 and 065. No change to the 10-state graph.
-- Additional trigger, rather than another rewrite of enforce_order_transition.
begin;
create or replace function public.require_transition_evidence() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if NEW.status is not distinct from OLD.status then return NEW; end if;
 if NEW.status in ('rejected','paused','rework')
    and length(regexp_replace(coalesce(current_setting('app.reason',true),''),'^[[:space:]]+|[[:space:]]+$','','g'))<3 then
  raise exception 'reason required';
 end if;
 if NEW.status='closed' then
  if coalesce(OLD.ai_result->>'verdict','') not in
     ('accepted','accepted_with_remarks','accepted_with_notes','needs_master_review','needs_master') then
   raise exception 'recognized non-rework review required';
  end if;
  if coalesce(jsonb_typeof(NEW.ai_result->'human_score'),'null')<>'number' then
   raise exception 'human quality score 1..5 required';
  end if;
  if (NEW.ai_result->>'human_score')::numeric not between 1 and 5
     or (NEW.ai_result->>'human_score')::numeric<>trunc((NEW.ai_result->>'human_score')::numeric) then
   raise exception 'human quality score integer 1..5 required';
  end if;
 end if;
 return NEW;
end $$;
drop trigger if exists ab_require_transition_evidence on public.orders;
create trigger ab_require_transition_evidence before update on public.orders
for each row execute function public.require_transition_evidence();
revoke all on function public.require_transition_evidence() from public;
commit;
