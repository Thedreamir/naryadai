drop function if exists public.mark_report_seen(bigint);
create function public.mark_report_seen(order_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o orders; uid uuid:=auth.uid(); r text;
begin
  if uid is null then return; end if;
  select role into r from employees where id=uid;
  if r not in ('master','admin') then return; end if;
  select * into o from orders where id=mark_report_seen.order_id;
  if not found or o.status not in ('ai_review','closed') then return; end if;
  if exists(select 1 from order_events where order_events.order_id=o.id and new_status='report_seen') then return; end if;
  insert into order_events(order_id,actor_id,old_status,new_status,reason) values(o.id,uid,o.status,'report_seen','Отчёт получен мастером');
  perform pg_notify('orders_changed',o.id::text);
end $$;
revoke all on function public.mark_report_seen(bigint) from public;
grant execute on function public.mark_report_seen(bigint) to authenticated;
