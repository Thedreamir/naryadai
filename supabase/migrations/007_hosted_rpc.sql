-- Hosted patch: transition_order accepts master human score at final close.
create or replace function transition_order(order_id bigint,target_status text,expected_version integer,reason_text text default '',closure_data jsonb default null,human_score integer default null,human_comment text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row_order orders;
begin
 select * into row_order from orders where id=order_id for update;
 if not found then raise exception 'order unavailable'; end if;
 if row_order.version<>expected_version then raise exception 'stale order version'; end if;
 perform set_config('app.reason',reason_text,true);
 update orders set status=target_status,
  closure=case when target_status='completed' then closure_data else closure end,
  ai_result=case when target_status='closed' then coalesce(ai_result,'{}'::jsonb)||jsonb_build_object('human_score',human_score,'human_comment',coalesce(human_comment,'')) else ai_result end
 where id=order_id returning * into row_order;
 return jsonb_build_object('id',row_order.id,'status',row_order.status,'version',row_order.version);
end $$;
revoke all on function transition_order(bigint,text,integer,text,jsonb,integer,text) from public;
grant execute on function transition_order(bigint,text,integer,text,jsonb,integer,text) to authenticated;
