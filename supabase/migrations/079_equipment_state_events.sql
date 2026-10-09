-- LOCAL ONLY: separately observed equipment state, never inferred from order status.
begin;
create table if not exists public.equipment_state_events(id bigint generated always as identity primary key,equipment_id bigint not null references equipment(id),state text not null check(state in('running','down')),observed_at timestamptz not null default now(),recorded_by uuid not null references employees(id),reason text not null check(length(btrim(reason))>=3));
alter table public.equipment_state_events enable row level security;
revoke all on public.equipment_state_events from public,anon,authenticated,naryad_app;
grant select on public.equipment_state_events to authenticated,naryad_app;
create policy equipment_state_read on public.equipment_state_events for select to authenticated,naryad_app using(current_actor_role() in('master','leader','admin') and exists(select 1 from employees where id=current_actor() and is_active));
create or replace function public.record_equipment_state(p_equipment bigint,p_state text,p_reason text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=current_actor(); result equipment_state_events;
begin
 if coalesce(current_actor_role(),'') not in('master','admin') or not exists(select 1 from employees where id=actor and is_active)then raise exception 'active master required';end if;
 if p_state is null or p_state not in('running','down') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'state and reason required';end if;
 perform 1 from equipment where id=p_equipment for update;if not found then raise exception 'equipment unavailable';end if;
 insert into equipment_state_events(equipment_id,state,recorded_by,reason)values(p_equipment,p_state,actor,btrim(p_reason))returning * into result;
 return to_jsonb(result);
end$$;
revoke all on function public.record_equipment_state(bigint,text,text)from public,anon;
grant execute on function public.record_equipment_state(bigint,text,text)to authenticated,naryad_app;
commit;
