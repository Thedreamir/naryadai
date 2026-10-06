create extension if not exists pgcrypto;
-- PIN quick login for shared shift devices. PINs are hashed with pgcrypto; raw PINs never stored.
create table if not exists public.pin_attempts (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  failures int not null default 0,
  locked_until timestamptz
);
alter table public.pin_attempts enable row level security;
-- no policies: only service role (edge function) touches this table

alter table public.employees add column if not exists pin_hash text;

create or replace function public.set_employee_pin(p_employee uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare caller_role text;
begin
  select role into caller_role from public.employees where id = auth.uid();
  if caller_role not in ('master','leader','admin') then
    raise exception 'pin management requires master, leader or admin role';
  end if;
  if p_pin !~ '^\d{4,6}$' then
    raise exception 'pin must be 4-6 digits';
  end if;
  update public.employees set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_employee;
end $$;
revoke all on function public.set_employee_pin(uuid, text) from public;
grant execute on function public.set_employee_pin(uuid, text) to authenticated;
