-- STAGED ONLY. No network call until a server secret and delivery-enable flag are configured.
-- Do not replace existing notification-generation logic without a live baseline read.
-- New-order notification gap must be separately reconciled with existing triggers/functions.
create or replace function public.telegram_notification_fanout() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare secret text:=current_setting('app.telegram_dispatch_secret',true); endpoint text:=current_setting('app.telegram_dispatch_url',true);
begin
 if coalesce(current_setting('app.telegram_delivery_enabled',true),'false')<>'true' or secret is null or secret='' or endpoint is null or endpoint='' then return new;end if;
 if endpoint!~'^https://[a-z0-9]+\.supabase\.co/functions/v1/telegram-dispatch$' then return new;end if;
 if not exists(select 1 from telegram_connections t join employees e on e.id=t.employee_id where t.employee_id=new.recipient_id and t.revoked_at is null and e.is_active) then return new;end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','X-Tekton-Telegram-Secret',secret),body:=jsonb_build_object('notification_id',new.id));
 return new;
end $$;
revoke all on function telegram_notification_fanout() from public,anon,authenticated;
-- Intentionally no CREATE TRIGGER until existing notification pipeline is reconciled.
