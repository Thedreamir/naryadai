-- LOCAL ONLY: test with full current transition/closure guards before deployment.
begin;
create or replace function public.server_review_gate() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if coalesce(auth.role(),'')='service_role' then return NEW; end if;
 if NEW.status='ai_review' and OLD.status is distinct from NEW.status then
  raise exception 'review must use server handler';
 end if;
 if (NEW.ai_result-'human_score'-'human_comment'-'human_override_at')
    is distinct from (OLD.ai_result-'human_score'-'human_comment'-'human_override_at') then
  raise exception 'model evidence must use server handler';
 end if;
 return NEW;
end $$;
create trigger aa_server_review_gate before update on public.orders for each row execute function public.server_review_gate();
-- Service-only RPC supplies the VERIFIED actor so existing actor/role/version/
-- transition/closure triggers remain active. It is not callable by the app.
create or replace function public.commit_ai_review(p_id bigint,p_version integer,p_actor uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare row_order public.orders;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service required';end if;
 if not exists(select 1 from employees where id=p_actor and is_active=true and role in ('master','admin')) then raise exception 'active master required';end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','service_role')::text,true);
 select * into row_order from orders where id=p_id for update;
 if not found or row_order.version<>p_version or row_order.status<>'completed' then raise exception 'stale review';end if;
 update orders set status='ai_review',ai_result=p_result where id=p_id returning * into row_order;
 insert into ai_reviews(order_id,verdict,score,confidence,needs_master_review,explanation,layer1,layer2,reasons,model,prompt_version)
 values(p_id,p_result->>'verdict',(p_result->>'score')::integer,(p_result->>'confidence')::numeric,
 coalesce((p_result->>'needs_master_review')::boolean,false),coalesce(p_result->>'report_master',''),
 p_result->'layer1',p_result->'layer2',p_result->'reasons',null,p_result->>'prompt_version');
 return jsonb_build_object('id',row_order.id,'version',row_order.version,'archived',true);
end $$;
revoke all on function public.commit_ai_review(bigint,integer,uuid,jsonb) from public,anon,authenticated,naryad_app;
grant execute on function public.commit_ai_review(bigint,integer,uuid,jsonb) to service_role;
revoke execute on function public.review_fallback(bigint,integer) from public,anon,authenticated,naryad_app;
commit;
