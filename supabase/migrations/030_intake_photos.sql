-- 030: intake photos ("фото ДО при приёмке") — captured by the assignee BEFORE work starts,
-- append-only with locked phase/time semantics. Closure displays existing BEFORE; it never
-- accepts retrospective before-photos.
alter table public.orders add column if not exists intake_photos jsonb not null default '[]';
create or replace function public.record_intake_photo(
  p_order_id int, p_storage_path text, p_sha256 text, p_byte_size int, p_mime text, p_captured_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_entry jsonb;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.assignee_id is distinct from auth.uid() then raise exception 'not the assignee'; end if;
  if v_order.status not in ('accepted','in_progress','rework','paused') then
    raise exception 'intake photos allowed only before completion (status %)', v_order.status; end if;
  if jsonb_array_length(coalesce(v_order.intake_photos,'[]'::jsonb)) >= 6 then
    raise exception 'intake photo limit reached'; end if;
  v_entry := jsonb_build_object(
    'phase','before_intake',
    'storage_path',p_storage_path,
    'sha256',p_sha256,
    'byte_size',p_byte_size,
    'mime_type',p_mime,
    'captured_client_at',p_captured_at,
    'server_received_at',now(),
    'limits','Время получения сервером, не доказательство времени съёмки'
  );
  update public.orders set intake_photos = coalesce(intake_photos,'[]'::jsonb) || v_entry where id = p_order_id;
  insert into public.order_photos (order_id, uploaded_by, sha256, byte_size, mime_type)
    values (p_order_id, auth.uid(), p_sha256, p_byte_size, p_mime);
  return (select intake_photos from public.orders where id = p_order_id);
end $$;
grant execute on function public.record_intake_photo(int,text,text,int,text,timestamptz) to authenticated;
