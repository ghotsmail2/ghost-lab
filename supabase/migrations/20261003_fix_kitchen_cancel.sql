-- Keep Kitchen Board cancellation durable. The previous function only changed
-- bills.status, so an order came back after the board refreshed because its
-- kitchen_status remained "received".
create or replace function public.cancel_bill_safely(p_bill_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bill public.bills%rowtype;
  actor public.staff%rowtype;
  used_stock record;
begin
  select * into actor
  from public.staff
  where auth_user_id = auth.uid() and active = true;

  if actor.id is null then
    raise exception 'No active staff account is linked to this login';
  end if;

  select * into target_bill
  from public.bills
  where id = p_bill_id
  for update;

  if target_bill.id is null then
    raise exception 'Bill not found';
  end if;

  if actor.role::text not in ('god', 'owner', 'chill_manager')
     and target_bill.staff_id <> actor.id then
    raise exception 'ไม่มีสิทธิ์ยกเลิกบิลนี้';
  end if;

  if target_bill.status::text in ('rejected', 'cancelled')
     or target_bill.kitchen_status = 'cancelled' then
    raise exception 'บิลนี้ถูกยกเลิกไปแล้ว';
  end if;

  for used_stock in
    select stock_item_id, sum(-change)::integer as quantity_to_return
    from public.stock_movements
    where bill_id = target_bill.id and change < 0
    group by stock_item_id
  loop
    update public.stock_items
    set quantity = quantity + used_stock.quantity_to_return,
        updated_by = actor.id,
        updated_at = now()
    where id = used_stock.stock_item_id;
  end loop;

  if target_bill.member_id is not null then
    update public.members
    set total_spent = greatest(0, total_spent - target_bill.total),
        visits = greatest(0, visits - 1)
    where id = target_bill.member_id;

    if exists (select 1 from public.member_repair_visits where bill_id = target_bill.id) then
      update public.members
      set repair_visits = greatest(0, repair_visits - 1)
      where id = target_bill.member_id;
    end if;
  end if;

  delete from public.member_rewards where earned_from_bill_id = target_bill.id;
  update public.member_rewards
  set status = 'available', redeemed_bill_id = null, redeemed_at = null
  where redeemed_bill_id = target_bill.id;
  delete from public.cash_ledger where bill_id = target_bill.id;
  delete from public.stock_movements where bill_id = target_bill.id;

  -- Excluding cancelled kitchen_status values makes the order stay gone after
  -- the next auto-refresh and after a new browser session.
  update public.bills
  set status = 'rejected',
      kitchen_status = 'cancelled',
      cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      cancelled_at = now()
  where id = target_bill.id;
end;
$$;

revoke all on function public.cancel_bill_safely(uuid, text) from public;
grant execute on function public.cancel_bill_safely(uuid, text) to authenticated;
