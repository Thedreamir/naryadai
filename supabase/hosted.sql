-- Run ONLY in a new synthetic Supabase test project, after core migrations.
create or replace function current_actor() returns uuid language sql stable as $$ select auth.uid() $$;
-- Policies use a common group; authenticated receives that role's narrow grants.
grant naryad_app to authenticated;
-- Supabase defaults must not override narrow application grants.
revoke all on orders,order_events,notifications,ai_cache from anon,authenticated;
grant select,insert,update on orders to authenticated;
grant select on order_events,notifications,order_report,employee_ratings,employees,sections,equipment,fault_codes,materials,crews to authenticated;
grant usage,select on all sequences in schema public to authenticated;
create or replace function transition_order(order_id bigint,target_status text,expected_version integer,reason_text text default '',closure_data jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row_order orders;
begin
 select * into row_order from orders where id=order_id for update;
 if not found then raise exception 'order unavailable'; end if;
 if row_order.version<>expected_version then raise exception 'stale order version'; end if;
 perform set_config('app.reason',reason_text,true);
 update orders set status=target_status,closure=case when target_status='completed' then closure_data else closure end where id=order_id returning * into row_order;
 return jsonb_build_object('id',row_order.id,'status',row_order.status,'version',row_order.version);
end $$;
revoke all on function transition_order(bigint,text,integer,text,jsonb) from public;
grant execute on function transition_order(bigint,text,integer,text,jsonb) to authenticated;
-- Do not expose users' roles as a writable self-service table.
revoke insert,update,delete on employees from authenticated,anon,naryad_app;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('repair-photos','repair-photos',false,400000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy repair_photo_insert on storage.objects for insert to authenticated with check(bucket_id='repair-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy repair_photo_read on storage.objects for select to authenticated using(bucket_id='repair-photos' and ((storage.foldername(name))[1]=auth.uid()::text or current_actor_role() in ('master','leader','admin')));
-- Realtime publication guarded for repeat deployment.
do $$ begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end $$;
