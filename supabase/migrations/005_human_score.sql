-- Master score can only be added at final confirmation, never by the worker.
create or replace function closure_integrity() returns trigger language plpgsql as $$
declare change_review boolean:=NEW.ai_result is distinct from OLD.ai_result;
begin
 if NEW.closure is distinct from OLD.closure and NEW.status<>'completed' then raise exception 'closure only allowed on completion'; end if;
 if change_review then
  if current_actor_role() not in ('master','admin') then raise exception 'review result cannot be written by worker'; end if;
  if NEW.status='closed' then
   if (NEW.ai_result-'human_score'-'human_comment') is distinct from (OLD.ai_result-'human_score'-'human_comment') then raise exception 'master score cannot alter model evidence'; end if;
   if jsonb_typeof(NEW.ai_result->'human_score')<>'number' or (NEW.ai_result->>'human_score')::numeric not between 1 and 5 then raise exception 'human quality score 1..5 required'; end if;
  elsif NEW.status<>'ai_review' then raise exception 'review only allowed during review'; end if;
 end if;
 if NEW.status='completed' then
  if not exists(select 1 from fault_codes where code=NEW.closure->>'fault_code') then raise exception 'unknown fault code'; end if;
  if jsonb_typeof(coalesce(NEW.closure->'materials','[]'::jsonb))<>'array' then raise exception 'invalid materials'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(NEW.closure->'materials','[]'::jsonb)) m where coalesce(m->>'quantity','0')::numeric<=0 or not exists(select 1 from materials where name=m->>'name')) then raise exception 'invalid material reference or quantity'; end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(NEW.closure->'photos','[]'::jsonb)) p where p !~ '^data:image/(jpeg|png|webp);base64,' or length(p)>400000) then raise exception 'invalid image or image too large'; end if;
  if jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))>5 then raise exception 'at most five photos'; end if;
 end if;
 return NEW;
end $$;
