-- Stage 5: server-side deadline watcher (case audit item 2).
-- check_deadlines(as_of) writes due_soon/overdue/unaccepted notifications (30-min dedup bucket).
create extension if not exists pg_cron;
select cron.schedule('naryad_check_deadlines', '* * * * *', $$select public.check_deadlines(now())$$);
