-- ROLLBACK IS SECURITY-REGRESSIVE: use only after comparing the pre-apply ACL snapshot.
-- Restore the previous broad grants only if needed to recover functionality,
-- then fix client column selection and re-apply 064. Never grant anon/public.
begin;
revoke select(id,name,role,specialty,on_shift,email,is_active,brigade) on public.employees from authenticated,naryad_app;
grant select on public.employees to authenticated,naryad_app;
commit;
