-- STAGED ONLY. Initial comment is distinct from title. Crew is a snapshot with
-- one responsible worker; this does not widen worker read/status permissions.
-- No live schema, grant or storage change is authorized by this file.
alter table public.orders add column if not exists initial_comment text not null default '' check(length(initial_comment)<=2000);
alter table public.orders add column if not exists crew_id bigint references public.crews(id);
alter table public.orders add column if not exists crew_members uuid[] not null default '{}';
create or replace function public.issue_order_context(p_title text,p_kind text,p_equipment bigint,p_assignee uuid,p_priority text,p_deadline timestamptz,p_comment text default '',p_crew bigint default null,p_members uuid[] default '{}')
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid:=current_actor();r text:=current_actor_role();nid bigint;crew_name text;member_count int;
begin
 if coalesce(r,'') not in ('master','admin') or not exists(select 1 from employees where id=who and is_active) then raise exception 'active master required';end if;
 if length(trim(p_title))<5 or length(p_title)>500 or length(coalesce(p_comment,''))>2000 or p_deadline<=now() then raise exception 'invalid order fields';end if;
 if p_kind not in ('planned','unplanned') or p_priority not in ('normal','high','emergency','planned') then raise exception 'invalid kind or priority';end if;
 if not exists(select 1 from employees where id=p_assignee and role='worker' and is_active and on_shift) then raise exception 'active on-shift responsible worker required';end if;
 if p_crew is null then
  if cardinality(p_members)>0 then raise exception 'crew members require crew';end if;
 else
  select name into crew_name from crews where id=p_crew;if not found then raise exception 'crew not found';end if;
  if p_members is null or cardinality(p_members)<1 or cardinality(p_members)>20 or not p_assignee=any(p_members) then raise exception 'responsible worker must belong to snapshot';end if;
  select count(distinct id) into member_count from employees where id=any(p_members) and role='worker' and is_active and on_shift and brigade=crew_name;
  if member_count<>cardinality(p_members) then raise exception 'invalid, duplicate or unavailable crew member';end if;
 end if;
 insert into orders(title,kind,equipment_id,assignee_id,master_id,priority,deadline,initial_comment,crew_id,crew_members)
 values(trim(p_title),p_kind,p_equipment,p_assignee,who,p_priority,p_deadline,trim(coalesce(p_comment,'')),p_crew,coalesce(p_members,'{}')) returning id into nid;
 return nid;
end $$;
-- Fail-closed staging: no client execution grant. Enabling it is a separate step.
revoke all on function public.issue_order_context(text,text,bigint,uuid,text,timestamptz,text,bigint,uuid[]) from public,anon,authenticated;
-- Grant authenticated only after owner approval and full-schema/RLS review.
