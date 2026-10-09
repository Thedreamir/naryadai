-- LOCAL ONLY. Explicit audited master decision, never relabelled as AI evidence.
begin;
create table if not exists public.manual_review_decisions(id bigint generated always as identity primary key,order_id bigint not null references orders(id),actor_id uuid not null references employees(id),decision text not null,reason text not null,score integer,review_failure text not null,created_at timestamptz not null default now());
alter table public.manual_review_decisions enable row level security;
drop policy if exists manual_decision_read on public.manual_review_decisions;
create policy manual_decision_read on public.manual_review_decisions for select to authenticated using(exists(select 1 from orders where id=order_id));
grant select on public.manual_review_decisions to authenticated;
create or replace function public.manual_master_decision(p_id bigint,p_version integer,p_decision text,p_score integer,p_reason text,p_failure text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders;actor uuid:=current_actor();r text:=current_actor_role();result jsonb;prior_role text:=current_setting('request.jwt.claim.role',true);
begin
 if actor is null or coalesce(r,'') not in ('master','admin') then raise exception 'active master required';end if;
 if p_decision is null or p_decision not in ('close','rework') or length(trim(coalesce(p_reason,'')))<3 or length(trim(coalesce(p_failure,'')))<3 then raise exception 'decision reason and review failure required';end if;
 if p_decision='close' and (p_score is null or p_score not between 1 and 5) then raise exception 'human score 1..5 required';end if;
 select * into o from orders where id=p_id for update;
 if p_version is null or not found or o.cancelled or o.status<>'completed' or o.version<>p_version then raise exception 'stale manual decision';end if;
 -- Service gate for exactly this server-built intermediate result. Not client AI.
 perform set_config('request.jwt.claim.role','service_role',true);
 update orders set status='ai_review',ai_result=jsonb_build_object('verdict','needs_master_review','mode','manual','score',null,'confidence',null,'needs_master_review',true,'reasons',jsonb_build_array('Проверка недоступна: '||left(p_failure,500)),'report_master','Решение мастера без автоматической проверки','limitations',jsonb_build_array('Не выполнена автоматическая проверка'),'human_score',null)where id=p_id returning * into o;
 perform set_config('request.jwt.claim.role',coalesce(prior_role,''),true);
 insert into manual_review_decisions(order_id,actor_id,decision,reason,score,review_failure)values(p_id,actor,p_decision,left(p_reason,1000),case when p_decision='close' then p_score else null end,left(p_failure,1000));
 result:=transition_order(p_id,case when p_decision='close' then 'closed' else 'rework' end,o.version,p_reason,null,case when p_decision='close' then p_score else null end,p_reason);
 return result;
end$$;
revoke all on function public.manual_master_decision(bigint,integer,text,integer,text,text) from public,anon,naryad_app;
grant execute on function public.manual_master_decision(bigint,integer,text,integer,text,text) to authenticated;
commit;
