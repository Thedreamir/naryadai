-- L9 isolated proposal for merge after 065. Never applied to a live database.
-- A repeat signal is closure -> next opening on the same equipment/fault.
-- Both reports must be closed and available before the as-of cutoff.
-- Configurable windows are for the repeat radar; case 6.6 rating remains 7 days.
create or replace function public.repeat_check(p_order_id bigint, p_as_of timestamptz default now())
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o orders; w int; prior bigint; after_n bigint; prior_ids bigint[]; after_ids bigint[];
begin
  if p_as_of is null then raise exception 'as-of required'; end if;
  select * into o from orders where id=p_order_id;
  if not found then raise exception 'order unavailable'; end if;
  if o.cancelled or o.status<>'closed' or o.closed_at is null or o.closed_at>=p_as_of
     or coalesce(o.closure->>'fault_code','')='' then
    return jsonb_build_object('applicable',false,'reason','Нужен закрытый наряд с шифром до конца периода');
  end if;
  select repeat_window_days into w from fault_codes where code=o.closure->>'fault_code';
  w:=greatest(1,coalesce(w,7));
  select count(*), array_agg(p.id order by p.closed_at desc,p.id) into prior,prior_ids
  from orders p where not p.cancelled and p.status='closed' and p.closed_at<p_as_of
    and p.id<>o.id and p.equipment_id=o.equipment_id
    and p.closure->>'fault_code'=o.closure->>'fault_code' and o.kind='unplanned'
    and o.created_at>p.closed_at and o.created_at<=p.closed_at+make_interval(days=>w);
  select count(*), array_agg(p.id order by p.created_at,p.id) into after_n,after_ids
  from orders p where not p.cancelled and p.status='closed' and p.closed_at<p_as_of
    and p.kind='unplanned' and p.id<>o.id and p.equipment_id=o.equipment_id
    and p.closure->>'fault_code'=o.closure->>'fault_code'
    and p.created_at>o.closed_at and p.created_at<=o.closed_at+make_interval(days=>w);
  return jsonb_build_object('applicable',true,'window_days',w,'fault_code',o.closure->>'fault_code',
    'prior_within_window',prior,'prior_ids',coalesce(prior_ids,'{}'),
    'repeats_after_within_window',after_n,'after_ids',coalesce(after_ids,'{}'),'as_of',p_as_of,
    'basis','По доступной вам истории закрытых нарядов: от закрытия до следующего внепланового наряда. Сигнал для проверки мастером, не вина исполнителя.');
end $$;

create or replace function public.repeat_top(p_since timestamptz,p_until timestamptz,p_limit integer default 5)
returns table(equipment_id bigint,equipment text,fault_code text,closed_count bigint,pairs_within_window bigint)
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if p_since is null or p_until is null or p_since>=p_until then raise exception 'invalid period'; end if;
  return query
  with base as (
    select o.id,o.equipment_id,e.name eq_name,o.kind,o.created_at,o.closed_at,o.closure->>'fault_code' fc,
      greatest(1,coalesce(f.repeat_window_days,7)) w
    from orders o join equipment e on e.id=o.equipment_id
      left join fault_codes f on f.code=o.closure->>'fault_code'
    where not o.cancelled and o.status='closed' and o.closed_at>=p_since and o.closed_at<p_until
      and coalesce(o.closure->>'fault_code','')<>''
  ), pairs as (
    select a.equipment_id,a.fc,count(*) n
    from base a join base b on a.equipment_id=b.equipment_id and a.fc=b.fc
      and b.kind='unplanned' and b.created_at>a.closed_at
      and b.created_at<=a.closed_at+make_interval(days=>a.w)
    group by a.equipment_id,a.fc
  )
  select b.equipment_id,b.eq_name,b.fc,count(distinct b.id),p.n
  from base b join pairs p on p.equipment_id=b.equipment_id and p.fc=b.fc
  group by b.equipment_id,b.eq_name,b.fc,p.n
  order by p.n desc,count(distinct b.id) desc,b.equipment_id,b.fc
  limit greatest(1,least(coalesce(p_limit,5),20));
end $$;
revoke all on function public.repeat_check(bigint,timestamptz),public.repeat_top(timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.repeat_check(bigint,timestamptz),public.repeat_top(timestamptz,timestamptz,integer) to authenticated;
