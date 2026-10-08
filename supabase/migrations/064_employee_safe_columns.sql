-- Local security preparation only. Validate current columns/grants before live apply.
-- RLS does not redact columns. Revoke broad SELECT, then explicit safe column ACL.
begin;
revoke select on public.employees from public, anon, authenticated, naryad_app;
-- Revoke possible earlier column-level grants on the secret as well.
revoke select(pin_hash) on public.employees from public, anon, authenticated, naryad_app;
grant select(id,name,role,specialty,on_shift,email,is_active,brigade)
 on public.employees to authenticated,naryad_app;
commit;
-- service_role and SECURITY DEFINER PIN functions retain existing access.
