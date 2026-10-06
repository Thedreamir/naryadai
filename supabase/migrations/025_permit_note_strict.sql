-- 025: stricter permit note validation (QA finding: 2 emoji passed the length check).
-- Confirmed permit now needs a real permit number (digit) and a confirmer (letter),
-- min 8 chars after trimming.
drop function if exists public.record_permit(bigint,text,text,integer);
create function public.record_permit(order_id bigint, kind text, note text, expected_version integer)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o orders; n text;
begin
  select * into o from orders where id=record_permit.order_id for update;
  if not found then raise exception 'order unavailable'; end if;
  if o.version<>record_permit.expected_version then raise exception 'stale order version'; end if;
  if record_permit.kind not in ('not_required','confirmed') then raise exception 'bad permit kind'; end if;
  if record_permit.kind='confirmed' then
    n:=btrim(coalesce(record_permit.note,''));
    if length(n)<8 then raise exception 'permit note required'; end if;
    if n !~ '[0-9]' then raise exception 'permit number required'; end if;
    if n !~ '[a-zA-Zа-яА-ЯёЁ]' then raise exception 'permit confirmer required'; end if;
  end if;
  if o.permit_kind is not null then raise exception 'permit already recorded'; end if;
  perform set_config('app.permit_update','1',true);
  perform set_config('app.permit_text', case when record_permit.kind='not_required' then 'Допуск не требуется' else 'Допуск подтверждён: '||record_permit.note end, true);
  update orders set permit_kind=record_permit.kind, permit_note=nullif(record_permit.note,''), permit_by=auth.uid(), permit_at=now() where id=o.id;
  return jsonb_build_object('id',o.id,'permit_kind',record_permit.kind);
end $$;
revoke all on function public.record_permit(bigint,text,text,integer) from public;
grant execute on function public.record_permit(bigint,text,text,integer) to authenticated;
