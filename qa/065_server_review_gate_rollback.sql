begin;
drop trigger if exists aa_server_review_gate on public.orders;
drop function if exists public.server_review_gate();
drop function if exists public.commit_ai_review(bigint,integer,uuid,jsonb);
-- Restores the previous bypass permission. Security-regressive, use only with
-- the prior handler/client rollback and after comparing pre-apply ACL snapshot.
grant execute on function public.review_fallback(bigint,integer) to authenticated;
commit;
