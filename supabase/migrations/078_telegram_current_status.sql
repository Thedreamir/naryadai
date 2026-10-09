-- Read-only current connection status, independent of ten-minute request expiry.
create or replace function public.telegram_pair_status() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid:=current_actor(); result jsonb; connected boolean;
begin
 if owner is null or coalesce(current_actor_role(),'') not in ('worker','master','leader','admin') then raise exception 'actor required';end if;
 if not exists(select 1 from employees where id=owner and is_active) then raise exception 'active actor required';end if;
 select exists(select 1 from telegram_connections where employee_id=owner and revoked_at is null) into connected;
 select jsonb_build_object('id',id,'pending_chat',pending_chat,'expires_at',expires_at,'confirmed',confirmed_at is not null)
 into result from telegram_pair_requests where employee_id=owner and revoked_at is null and expires_at>now() order by created_at desc limit 1;
 return coalesce(result,'{}'::jsonb)||jsonb_build_object('connected',connected);
end $$;
revoke all on function public.telegram_pair_status() from public,anon;
grant execute on function public.telegram_pair_status() to authenticated;
