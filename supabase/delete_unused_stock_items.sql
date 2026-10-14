-- Permanently delete only stock items that have never been used.
-- Items with remaining stock, BOM links, or movement history are preserved.
create or replace function public.delete_unused_stock_item(p_stock_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.staff%rowtype;
  target public.stock_items%rowtype;
begin
  select * into actor
  from public.staff
  where auth_user_id = auth.uid() and active = true;

  if not found or actor.role::text not in ('owner', 'god') then
    raise exception 'เฉพาะ Owner หรือ GOD เท่านั้นที่ลบวัตถุดิบได้' using errcode = '42501';
  end if;

  if p_stock_item_id is null then
    raise exception 'ไม่พบวัตถุดิบที่ต้องการลบ' using errcode = '22023';
  end if;

  select * into target
  from public.stock_items
  where id = p_stock_item_id
  for update;

  if not found then
    raise exception 'ไม่พบวัตถุดิบนี้ อาจถูกลบไปแล้ว' using errcode = 'P0002';
  end if;
  if target.quantity <> 0 then
    raise exception 'ลบไม่ได้: ต้องปรับยอดคงเหลือให้เป็น 0 ก่อน' using errcode = '23514';
  end if;
  if exists (select 1 from public.service_materials where stock_item_id = target.id) then
    raise exception 'ลบไม่ได้: วัตถุดิบนี้ยังถูกใช้ในสูตรของบริการ' using errcode = '23503';
  end if;
  if exists (select 1 from public.stock_movements where stock_item_id = target.id) then
    raise exception 'ลบไม่ได้: วัตถุดิบนี้มีประวัติรับเข้า/เบิกออก ให้เก็บไว้เพื่อรักษาประวัติ' using errcode = '23503';
  end if;

  delete from public.stock_items where id = target.id;
end;
$$;

revoke all on function public.delete_unused_stock_item(uuid) from public, anon;
grant execute on function public.delete_unused_stock_item(uuid) to authenticated;
