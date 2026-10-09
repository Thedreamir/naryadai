-- LOCAL CANDIDATE ONLY. Narrow direct writes; validated RPCs retain actor guards.
begin;
revoke update on public.orders from public,anon,authenticated,naryad_app;
grant update(status,closure,ai_result) on public.orders to authenticated,naryad_app;
-- record_permit already checks role, assignee, version and format through trigger.
alter function public.record_permit(bigint,text,text,integer) security definer;
create or replace function public.guard_order_evidence_columns() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare r text:=current_actor_role();
begin
 if NEW.cancelled is distinct from OLD.cancelled and not (coalesce(r,'') in ('master','admin') and current_setting('app.manage_order',true)='1' and NEW.status=OLD.status) then raise exception 'cancel via master manage_order only';end if;
 if NEW.permit_kind is distinct from OLD.permit_kind or NEW.permit_note is distinct from OLD.permit_note or NEW.permit_by is distinct from OLD.permit_by or NEW.permit_at is distinct from OLD.permit_at then
  if OLD.permit_kind is not null or NEW.status<>OLD.status or coalesce(current_setting('app.permit_update',true),'')<>'1' or coalesce(r,'')<>'worker' or current_actor() is distinct from OLD.assignee_id or NEW.permit_by is distinct from current_actor() or NEW.permit_at is null or NEW.permit_at<>transaction_timestamp() then raise exception 'permit immutable except record_permit';end if;
 end if;
 if NEW.status='in_progress' and NEW.status<>OLD.status then
  if not exists(select 1 from public.order_declarations d where d.order_id=OLD.id and d.declared_by=current_actor() and d.confirmed and not d.excluded_from_evidence and d.phase='pre_work' and d.text='Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)') or not exists(select 1 from public.order_declarations d where d.order_id=OLD.id and d.declared_by=current_actor() and d.confirmed and not d.excluded_from_evidence and d.phase='pre_work' and d.text='Подтверждаю лично: использую средства защиты, зона работ безопасна') then raise exception 'two required pre-work declarations required';end if;
 end if;
 return NEW;
end $$;
drop trigger if exists aa_guard_order_evidence_columns on public.orders;
create trigger aa_guard_order_evidence_columns before update on public.orders for each row execute function public.guard_order_evidence_columns();
create or replace function public.start_work_with_declarations(p_order_id bigint,p_expected_version integer,p_texts text[])returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r jsonb;o orders;required text[]:=array['Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)','Подтверждаю лично: использую средства защиты, зона работ безопасна'];
begin
 select * into o from orders where id=p_order_id for update;
 if not found or o.assignee_id is distinct from auth.uid() or coalesce(current_actor_role(),'')<>'worker' then raise exception 'assigned active worker required';end if;
 if o.version<>p_expected_version then raise exception 'stale order version';end if;
 if cardinality(p_texts) is distinct from 2 or not (p_texts @> required and required @> p_texts) then raise exception 'exactly two required declarations';end if;
 insert into order_declarations(order_id,declared_by,phase,text)select p_order_id,auth.uid(),'pre_work',t from unnest(p_texts)t;
 r:=transition_order(p_order_id,'in_progress',p_expected_version,'',null,null,'');return r;
end $$;
revoke all on function public.guard_order_evidence_columns() from public;
commit;
