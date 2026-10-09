-- Synthetic authenticated-session assertion only. Never selects actual hashes.
begin;
set local role authenticated;
do $$ begin
 begin
  execute 'select pin_hash from public.employees limit 0';
  raise exception 'SECURITY FAILURE: authenticated can select pin_hash';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
