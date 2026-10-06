-- 028: "Контроль повторов" - repeat-repair SIGNAL, never a verdict.
-- Window is configurable per fault code. Reads run as the caller (RLS applies),
-- so results are always "по доступной вам истории".
alter table public.fault_codes add column if not exists repeat_window_days integer not null default 7;
update public.fault_codes set repeat_window_days=7 where repeat_window_days is null;

drop function if exists public.repeat_check(bigint,timestamptz);
create function public.repeat_check(p_order_id bigint, p_as_of timestamptz default now())
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o orders; w int; prior int; after_n int; prior_ids bigint[]; after_ids bigint[];
begin
  select * into o from orders where id=p_order_id;
  if not found then raise exception 'order unavailable'; end if;
  if o.closure->>'fault_code' is null then
    return jsonb_build_object('applicable',false,'reason','Шифр неисправности не указан');
  end if;
  select repeat_window_days into w from fault_codes where code=o.closure->>'fault_code';
  w:=coalesce(w,7);
  -- backward: is this order itself a repeat of an earlier one?
  select count(*), array_agg(x.id order by x.created_at desc) into prior, prior_ids from (
    select id, created_at from orders p
    where p.equipment_id=o.equipment_id and p.closure->>'fault_code'=o.closure->>'fault_code'
      and p.status='closed' and p.id<>o.id and p.created_at < o.created_at
      and p.created_at >= o.created_at - make_interval(days=>w)
    order by p.created_at desc limit 5) x;
  -- forward: did a repeat follow this order within the window (as of p_as_of)?
  select count(*), array_agg(x.id order by x.created_at) into after_n, after_ids from (
    select id, created_at from orders p
    where p.equipment_id=o.equipment_id and p.closure->>'fault_code'=o.closure->>'fault_code'
      and p.status='closed' and p.id<>o.id and p.created_at >= o.created_at
      and p.created_at <= least(o.created_at + make_interval(days=>w), p_as_of)
    order by p.created_at limit 5) x;
  return jsonb_build_object(
    'applicable',true,'window_days',w,'fault_code',o.closure->>'fault_code',
    'prior_within_window',prior,'prior_ids',coalesce(prior_ids,'{}'),
    'repeats_after_within_window',after_n,'after_ids',coalesce(after_ids,'{}'),
    'as_of',p_as_of,
    'basis','По доступной вам истории нарядов. Сигнал для проверки мастером, не оценка исполнителя.');
end $$;
revoke all on function public.repeat_check(bigint,timestamptz) from public;
grant execute on function public.repeat_check(bigint,timestamptz) to authenticated;

drop function if exists public.repeat_top(timestamptz,timestamptz,integer);
create function public.repeat_top(p_since timestamptz, p_until timestamptz, p_limit integer default 5)
returns table(equipment_id bigint, equipment text, fault_code text, closed_count bigint, pairs_within_window bigint)
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  return query
  with base as (
    select o.id, o.equipment_id, e.name as eq_name, o.closure->>'fault_code' as fc, o.created_at,
           (select repeat_window_days from fault_codes f where f.code=o.closure->>'fault_code') as w
    from orders o join equipment e on e.id=o.equipment_id
    where o.status='closed' and o.closure->>'fault_code' is not null
      and o.created_at >= p_since and o.created_at <= p_until
  ), pairs as (
    select a.equipment_id, a.fc, count(*) as n
    from base a join base b on a.equipment_id=b.equipment_id and a.fc=b.fc and a.id<b.id
      and b.created_at - a.created_at <= make_interval(days=>coalesce(a.w,7))
    group by 1,2
  )
  select b.equipment_id, b.eq_name, b.fc, count(distinct b.id), coalesce(p.n,0)
  from base b left join pairs p on p.equipment_id=b.equipment_id and p.fc=b.fc
  group by b.equipment_id, b.eq_name, b.fc, p.n
  having count(distinct b.id)>1
  order by coalesce(p.n,0) desc, count(distinct b.id) desc
  limit greatest(1,least(p_limit,20));
end $$;
revoke all on function public.repeat_top(timestamptz,timestamptz,integer) from public;
grant execute on function public.repeat_top(timestamptz,timestamptz,integer) to authenticated;
