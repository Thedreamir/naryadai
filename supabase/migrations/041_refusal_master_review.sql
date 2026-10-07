-- 041: disputed refusal review, explicit human audit. Original event reason stays immutable.
create table if not exists public.refusal_reviews (
 event_id bigint primary key references public.order_events(id),
 classification text not null check (classification in ('justified','unjustified')),
 note text not null check(length(trim(note))>=3),
 reviewer_id uuid not null references public.employees(id), reviewed_at timestamptz not null default now()
);
alter table public.refusal_reviews enable row level security;
create policy refusal_review_read on public.refusal_reviews for select to authenticated using (
 current_actor_role() in ('master','leader','admin') or exists(select 1 from order_events e where e.id=event_id and e.actor_id=current_actor())
);
grant select on public.refusal_reviews to authenticated;
grant all on public.refusal_reviews to service_role;
create or replace function public.review_refusal(p_event_id bigint,p_classification text,p_note text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(current_actor_role(),'') not in ('master','admin') then raise exception 'master action required'; end if;
 if p_classification not in ('justified','unjustified') or p_classification is null then raise exception 'bad classification'; end if;
 if not exists(select 1 from order_events where id=p_event_id and new_status='rejected') then raise exception 'refusal unavailable'; end if;
 -- one final decision per event; correction requires a separate future versioned workflow, not silent overwrite
 insert into refusal_reviews(event_id,classification,note,reviewer_id) values(p_event_id,p_classification,p_note,current_actor());
end $$;
revoke all on function public.review_refusal(bigint,text,text) from public,anon;
grant execute on function public.review_refusal(bigint,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.worker_rating(since timestamp with time zone, until timestamp with time zone)
 RETURNS TABLE(worker_id uuid, name text, closed bigint, on_time bigint, rework bigint, complexity bigint, rejects_unjustified bigint, rejects_unclassified bigint, rejects_justified bigint, quality_avg numeric, quality_n bigint, incomplete_window bigint, f_quality numeric, f_ontime numeric, f_rework numeric, f_volume numeric, f_rejects numeric, total numeric, factors_available integer, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare maxc bigint; myrole text:=current_actor_role(); myid uuid:=current_actor();
begin
  if coalesce(myrole,'') not in ('worker','master','leader','admin') then raise exception 'actor required'; end if;
  select greatest(1, sum(case o.priority when 'emergency' then 3 when 'high' then 2 else 1 end))
    into maxc
    from orders o where not o.cancelled and o.status='closed' and o.closed_at >= since and o.closed_at < until
    group by o.assignee_id order by 1 desc limit 1;
  maxc := coalesce(maxc, 1);
  return query
  with cl as (
    select o.* from orders o where not o.cancelled and o.status='closed' and o.closed_at >= since and o.closed_at < until
      and (myrole in ('master','leader','admin') or o.assignee_id=myid)
  ), rw as (
    -- factor 3: rework event OR repeat failure = SAME fault code on SAME equipment within 7 days.
    -- each closed order counted once; closures <7 days old have an incomplete observation window.
    select c.id from cl c
    where exists (select 1 from order_events e where e.order_id=c.id and e.new_status='rework' and e.created_at<until)
       or exists (select 1 from orders o2 where o2.id<>c.id
                  and not o2.cancelled and o2.kind='unplanned' and public.is_repeat_asof(c.equipment_id,o2.equipment_id,c.closure->>'fault_code',o2.closure->>'fault_code',c.closed_at,o2.created_at,until))
  ), base as (
    select c.assignee_id wid,
      count(*) c,
      count(*) filter (where c.closed_at <= c.deadline) ot,
      count(*) filter (where c.id in (select id from rw)) rw,
      count(*) filter (where c.closed_at > until - interval '7 days') iw,
      sum(case c.priority when 'emergency' then 3 when 'high' then 2 else 1 end) cx,
      avg(nullif(c.ai_result->>'human_score','')::numeric) qavg,
      count(nullif(c.ai_result->>'human_score','')) qn
    from cl c
    group by c.assignee_id
  ), rej as (
    -- Explicit codes only. Unknown/disputed reasons require master review; exclude entire factor until classified.
    -- Counts belong to event actor, never to current assignee.
    select e.actor_id wid,
      count(*) filter (where coalesce(rr.classification,refusal_class(e.reason))='unjustified') unj,
      count(*) filter (where coalesce(rr.classification,refusal_class(e.reason))='unknown') unc,
      count(*) filter (where coalesce(rr.classification,refusal_class(e.reason))='justified') justified
    from order_events e left join refusal_reviews rr on rr.event_id=e.id and rr.reviewed_at<until
    where e.new_status='rejected' and e.created_at >= since and e.created_at < until
    group by e.actor_id
  )
  select rated.* from (select b.wid, emp.name, b.c, b.ot, b.rw, b.cx, coalesce(r.unj,0), coalesce(r.unc,0), coalesce(r.justified,0), round(b.qavg,2), b.qn, b.iw,
    case when b.qn>0 then round(b.qavg/5*100,1) end,
    round(b.ot::numeric/b.c*100,1),
    round((1-b.rw::numeric/b.c)*100,1),
    round(b.cx::numeric/maxc*100,1),
    case when coalesce(r.unc,0)=0 then greatest(0,100-coalesce(r.unj,0)*25)::numeric end,
    round((
      coalesce(case when b.qn>0 then b.qavg/5*100 end,0)*case when b.qn>0 then 30 else 0 end
      + b.ot::numeric/b.c*100*25
      + (1-b.rw::numeric/b.c)*100*20
      + b.cx::numeric/maxc*100*15
      + case when coalesce(r.unc,0)=0 then greatest(0,100-coalesce(r.unj,0)*25)*10 else 0 end
    )/(60+case when b.qn>0 then 30 else 0 end+case when coalesce(r.unc,0)=0 then 10 else 0 end),1) as total,
    3+case when b.qn>0 then 1 else 0 end+case when coalesce(r.unc,0)=0 then 1 else 0 end,
    'Срез as-of: события и повторы строго до конца периода, не причинный вывод. Закрыто '||b.c||'; в срок '||round(b.ot::numeric/b.c*100)||'% ('||b.ot||'/'||b.c||'); доработка или повтор того же шифра на том же оборудовании за 7 дн: '
      ||b.rw||case when b.iw>0 then ' (у '||b.iw||' закрытий окно повторов неполное)' else '' end
      ||'; сложность '||b.cx||' балла (приближение по приоритету: аварийный=3, высокий=2, прочий=1 — не замеренная трудоёмкость); отказы без причины: '
      ||coalesce(r.unj,0)||case when coalesce(r.unc,0)>0 then '; отказов с неклассифицированной причиной (нужна проверка мастера, фактор отказов исключён): '||r.unc else '' end
      ||case when b.qn>0 then '; качество '||round(b.qavg,1)||'/5 по '||b.qn||' оценкам мастера'
      else '; оценок качества нет — фактор исключён, веса перенормированы' end
  from base b
  join employees emp on emp.id=b.wid
  left join rej r on r.wid=b.wid
  ) rated order by rated.total desc nulls last;
end $function$;
select pg_notify('pgrst','reload schema');
