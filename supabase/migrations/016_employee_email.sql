alter table public.employees add column if not exists email text;
update public.employees e set email = u.email from auth.users u where u.id = e.id and e.email is null;
create unique index if not exists employees_email_key on public.employees(email) where email is not null;
grant select, insert, update on public.pin_attempts to service_role;
grant select on public.employees to service_role;
