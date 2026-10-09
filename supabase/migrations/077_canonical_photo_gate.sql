-- LOCAL CANDIDATE. Unplanned completion fails closed until server ingest is wired.
-- This table is written ONLY by trusted canonical ingest, never by browser metadata.
begin;
create table if not exists public.canonical_photo_evidence(
 id bigint generated always as identity primary key,order_id bigint not null references orders(id),uploaded_by uuid not null references employees(id),storage_path text not null unique,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),byte_size integer not null check(byte_size between 1 and 290000),mime_type text not null check(mime_type='image/jpeg'),phase text not null check(phase in ('before','after')),received_at timestamptz not null default now(),decoder_version text not null,unique(order_id,sha256,phase));
alter table public.canonical_photo_evidence enable row level security;
revoke all on public.canonical_photo_evidence from public,anon,authenticated,naryad_app;
grant select,insert on public.canonical_photo_evidence to service_role;
grant usage,select on sequence public.canonical_photo_evidence_id_seq to service_role;
create or replace function public.require_canonical_after_evidence()returns trigger language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare uri text;payload bytea;h text;
begin
 if NEW.status<>'completed' or NEW.status=OLD.status or NEW.kind<>'unplanned' then return NEW;end if;
 if jsonb_array_length(coalesce(NEW.closure->'photos','[]'::jsonb))=0 then raise exception 'after photo required';end if;
 for uri in select jsonb_array_elements_text(NEW.closure->'photos')loop
  if uri !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$' or length(uri)>400000 then raise exception 'canonical JPEG required';end if;
  begin payload:=decode(split_part(uri,',',2),'base64');exception when others then raise exception 'invalid canonical image';end;
  if octet_length(payload)>290000 or substring(payload from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'invalid canonical image';end if;
  h:=encode(digest(payload,'sha256'),'hex');
  if not exists(select 1 from canonical_photo_evidence e where e.order_id=OLD.id and e.uploaded_by=OLD.assignee_id and e.phase='after' and e.sha256=h and e.byte_size=octet_length(payload) and e.received_at>=OLD.created_at)then raise exception 'server verified after photo required; canonical ingest unavailable';end if;
 end loop;
 return NEW;
end$$;
drop trigger if exists ac_canonical_after_evidence on public.orders;
create trigger ac_canonical_after_evidence before update on public.orders for each row execute function public.require_canonical_after_evidence();
revoke all on function public.require_canonical_after_evidence() from public;
commit;
