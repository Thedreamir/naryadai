create extension if not exists pgcrypto;
create or replace function public.verify_employee_pin(p_employee uuid, p_pin text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select pin_hash is not null and pin_hash = crypt(p_pin, pin_hash) from public.employees where id = p_employee
$$;
revoke all on function public.verify_employee_pin(uuid, text) from public;
revoke all on function public.verify_employee_pin(uuid, text) from authenticated;
grant execute on function public.verify_employee_pin(uuid, text) to service_role;
