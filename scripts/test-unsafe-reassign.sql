do $test$
declare fixture bigint; st text; caught boolean; original uuid; target uuid;
begin
 perform set_config('request.jwt.claim.sub','63e3cc37-620e-41df-a3b7-14d3b6cacdfc',true);
 foreach st in array array['in_progress','rework'] loop
  select id,assignee_id into fixture,original from orders where status=st and not cancelled order by id desc limit 1;
  if fixture is null then raise exception 'no source row for %',st; end if;
  select id into target from employees where role='worker' and id<>original and is_active limit 1;
  caught:=false;
  begin perform manage_order(fixture,'reassign',target);
  exception when others then
   if SQLERRM <> 'reassign only issued/queued/rejected' then raise; end if;
   caught:=true;
  end;
  if not caught then raise exception 'assertion failed: unsafe reassign % accepted',st; end if;
  if (select assignee_id from orders where id=fixture) is distinct from original then raise exception 'assertion failed: assignee mutated'; end if;
 end loop;
end $test$;