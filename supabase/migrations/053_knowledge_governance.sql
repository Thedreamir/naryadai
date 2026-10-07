-- Synthetic knowledge uploads: draft -> master approval -> revoke. No implicit publication.
alter table public.knowledge_docs add column if not exists status text not null default 'draft' check(status in ('draft','approved','rejected','revoked'));
alter table public.knowledge_docs add column if not exists version integer not null default 1;
alter table public.knowledge_docs add column if not exists author_id uuid references public.employees(id);
alter table public.knowledge_docs add column if not exists reviewed_by uuid references public.employees(id);
alter table public.knowledge_docs add column if not exists reviewed_at timestamptz;
alter table public.knowledge_docs add column if not exists review_note text not null default '';
alter table public.knowledge_docs add column if not exists synthetic boolean not null default true;
-- Existing curated demo docs become drafts until a master reviews them.
drop policy if exists knowledge_docs_read on public.knowledge_docs;
drop policy if exists knowledge_docs_write on public.knowledge_docs;
drop policy if exists knowledge_docs_update on public.knowledge_docs;
create policy knowledge_docs_read on public.knowledge_docs for select to authenticated using(exists(select 1 from public.employees where id=current_actor() and is_active) and (status='approved' or current_actor_role() in ('master','leader','admin')));
revoke insert,update,delete on public.knowledge_docs from authenticated;
create table if not exists public.knowledge_doc_events(id bigint generated always as identity primary key,doc_id bigint not null references public.knowledge_docs(id),actor_id uuid not null references public.employees(id),event text not null,version integer not null,title text not null,body text not null,note text not null default '',created_at timestamptz not null default now());
alter table public.knowledge_doc_events enable row level security;
create policy knowledge_events_read on public.knowledge_doc_events for select to authenticated using(current_actor_role() in ('master','leader','admin'));
grant select on public.knowledge_doc_events to authenticated;
grant all on public.knowledge_doc_events to service_role;
create or replace function public.submit_knowledge_doc(p_title text,p_body text,p_source text,p_equipment bigint default null) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare nid bigint;
begin
 if not exists(select 1 from employees where id=current_actor() and is_active) then raise exception 'active actor required';end if;
 if coalesce(current_actor_role(),'') not in ('master','leader','admin') then raise exception 'master or leader required';end if;
 if length(trim(p_title))<5 or length(p_title)>200 or length(trim(p_body))<20 or length(p_body)>12000 or length(p_source)>200 then raise exception 'invalid document length';end if;
 insert into knowledge_docs(title,body,source_label,equipment_id,status,author_id,synthetic) values(trim(p_title),trim(p_body),trim(p_source),p_equipment,'draft',current_actor(),true) returning id into nid;
 insert into knowledge_doc_events(doc_id,actor_id,event,version,title,body) values(nid,current_actor(),'draft',1,trim(p_title),trim(p_body));return nid;
end $$;
create or replace function public.review_knowledge_doc(p_id bigint,p_action text,p_version integer,p_note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d knowledge_docs%rowtype; target text;
begin
 if not exists(select 1 from employees where id=current_actor() and is_active) then raise exception 'active actor required';end if;
 if coalesce(current_actor_role(),'') not in ('master','admin') then raise exception 'master required';end if;
 select * into d from knowledge_docs where id=p_id for update;if not found then raise exception 'document not found';end if;
 if d.version<>p_version then raise exception 'version changed';end if;
 if p_action='approve' and d.status='draft' then target:='approved';elsif p_action='reject' and d.status='draft' then target:='rejected';elsif p_action='revoke' and d.status='approved' then target:='revoked';else raise exception 'invalid review transition';end if;
 if length(trim(p_note))<3 or length(p_note)>500 then raise exception 'review note required';end if;
 update knowledge_docs set status=target,version=version+1,reviewed_by=current_actor(),reviewed_at=now(),review_note=p_note where id=p_id;
 insert into knowledge_doc_events(doc_id,actor_id,event,version,title,body,note) values(p_id,current_actor(),target,d.version+1,d.title,d.body,p_note);
end $$;
revoke all on function public.submit_knowledge_doc(text,text,text,bigint) from public,anon;
revoke all on function public.review_knowledge_doc(bigint,text,integer,text) from public,anon;
grant execute on function public.submit_knowledge_doc(text,text,text,bigint) to authenticated;
grant execute on function public.review_knowledge_doc(bigint,text,integer,text) to authenticated;
select pg_notify('pgrst','reload schema');
