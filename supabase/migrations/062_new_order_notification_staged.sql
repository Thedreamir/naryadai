-- STAGED ONLY. Inspect live INSERT triggers before adding; never duplicate a live pipeline.
-- No network calls. The notification is the shared durable event for channel dispatch.
create or replace function public.notify_new_order_durable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.cancelled or new.status not in ('issued','queued') or new.assignee_id is null then return new;end if;
 insert into notifications(order_id,recipient_id,kind,message,bucket)
 values(new.id,new.assignee_id,'new_order','Новый наряд #'||new.id||': '||new.title,0)
 on conflict(order_id,recipient_id,kind,bucket) do nothing;
 return new;
end $$;
revoke all on function public.notify_new_order_durable() from public,anon,authenticated;
-- Do NOT create a live trigger without current-source reconciliation and rollback.
