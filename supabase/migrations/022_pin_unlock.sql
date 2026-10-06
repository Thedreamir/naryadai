-- 022: master/admin can clear a PIN lockout so a locked-out worker is not blocked
-- from urgent work. Only the lockout counter is cleared; the PIN itself is untouched.
create or replace function public.pin_unlock(employee_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); r text; target uuid; had boolean;
begin
  if uid is null then raise exception 'actor required'; end if;
  select role into r from employees where id=uid;
  if r not in ('master','admin') then raise exception 'master required'; end if;
  select id into target from employees where email=employee_email;
  if target is null then raise exception 'employee not found'; end if;
  select exists(select 1 from pin_attempts where employee_id=target and (failures>0 or locked_until is not null)) into had;
  delete from pin_attempts where employee_id=target;
  return jsonb_build_object('cleared',had);
end $$;
revoke all on function public.pin_unlock(text) from public;
grant execute on function public.pin_unlock(text) to authenticated;
