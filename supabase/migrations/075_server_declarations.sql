-- LOCAL ONLY. No direct writes, server times, validated actor/order window.
begin;
revoke insert,update,delete on public.order_declarations from public,anon,authenticated,naryad_app;
alter function public.start_work_with_declarations(bigint,integer,text[]) security definer;
create or replace function public.stamp_declaration_time()returns trigger language plpgsql set search_path=public,pg_temp as $$begin NEW.declared_at:=transaction_timestamp();return NEW;end$$;
drop trigger if exists stamp_declaration_time on public.order_declarations;
create trigger stamp_declaration_time before insert on public.order_declarations for each row execute function public.stamp_declaration_time();
create or replace function public.record_late_declarations(p_order_id bigint,p_phase text,p_texts text[],p_version integer)returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders;t text;k text;
begin
 select * into o from orders where id=p_order_id for update;
 if not found or current_actor() is distinct from o.assignee_id or coalesce(current_actor_role(),'')<>'worker' or o.cancelled then raise exception 'assigned active worker required';end if;
 if o.version<>p_version then raise exception 'stale order version';end if;
 if o.status not in ('in_progress','rework','paused') or p_phase not in ('pre_work_late','pre_work_at_surrender','post_work') then raise exception 'declaration window closed';end if;
 if cardinality(p_texts) is null or cardinality(p_texts) not between 1 and 2 then raise exception 'declaration count invalid';end if;
 foreach t in array p_texts loop
  if t is null or length(trim(t)) not between 20 and 500 then raise exception 'declaration text invalid';end if;
  k:=encode(digest(jsonb_build_array(current_actor(),p_order_id,p_version,p_phase,t)::text,'sha256'),'hex');
  insert into order_declarations(order_id,declared_by,phase,text,confirmed,declarations_idempotency_key)values(p_order_id,current_actor(),p_phase,t,true,k)on conflict(declarations_idempotency_key)do nothing;
 end loop;
end$$;
revoke all on function public.record_late_declarations(bigint,text,text[],integer) from public;
grant execute on function public.record_late_declarations(bigint,text,text[],integer) to authenticated;
commit;
