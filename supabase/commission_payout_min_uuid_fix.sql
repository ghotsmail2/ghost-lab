-- Hotfix for pay_staff_commission on PostgreSQL versions without min(uuid).
-- Keeps the existing transaction-safe payout, cash-ledger, and distribution updates.
create or replace function public.pay_staff_commission(
  p_staff_id uuid,
  p_bill_ids uuid[],
  p_reference text default null,
  p_note text default null,
  p_bonus integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.staff%rowtype;
  recipient public.staff%rowtype;
  new_payout_id uuid;
  commission_total integer;
  payout_total integer;
  payout_count integer;
  payout_branch uuid;
begin
  select * into actor
  from public.staff
  where auth_user_id = auth.uid() and active;

  if actor.id is null or actor.role::text not in ('owner', 'god') then
    raise exception 'Owner เท่านั้นที่จ่ายค่าคอมได้';
  end if;
  if coalesce(p_bonus, 0) < 0 then
    raise exception 'โบนัสต้องไม่ติดลบ';
  end if;
  if coalesce(array_length(p_bill_ids, 1), 0) = 0 then
    raise exception 'ไม่มีบิลที่รอจ่าย';
  end if;

  select * into recipient from public.staff where id = p_staff_id;
  if recipient.id is null then
    raise exception 'ไม่พบพนักงานที่รับค่าคอม';
  end if;

  perform d.id
  from public.commission_distributions d
  where d.bill_id = any(p_bill_ids)
    and d.user_id = p_staff_id
    and d.paid_at is null
    and d.reversed_at is null
  for update;

  select coalesce(sum(d.amount), 0),
         count(distinct d.bill_id),
         (array_agg(distinct b.branch_id order by b.branch_id))[1]
    into commission_total, payout_count, payout_branch
  from public.commission_distributions d
  join public.bills b on b.id = d.bill_id
  where d.bill_id = any(p_bill_ids)
    and d.user_id = p_staff_id
    and d.paid_at is null
    and d.reversed_at is null
    and b.status::text not in ('rejected', 'cancelled');

  if payout_count <> array_length(p_bill_ids, 1) or commission_total <= 0 then
    raise exception 'มีบิลที่ถูกจ่ายไปแล้ว หรือไม่มีสิทธิ์รับค่าคอม';
  end if;
  if (select count(distinct b.branch_id) from public.bills b where b.id = any(p_bill_ids)) <> 1 then
    raise exception 'กรุณาจ่ายแยกตามสาขา';
  end if;

  payout_total := commission_total + coalesce(p_bonus, 0);

  insert into public.commission_payouts (
    staff_id, branch_id, total_amount, bonus, bill_count,
    transfer_reference, note, paid_by
  ) values (
    p_staff_id,
    payout_branch,
    payout_total,
    coalesce(p_bonus, 0),
    payout_count,
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    actor.id
  )
  returning id into new_payout_id;

  insert into public.cash_ledger (
    entry_type, amount, description, commission_payout_id, created_by
  ) values (
    'commission_payout',
    -payout_total,
    'จ่ายค่าคอม ' || coalesce(recipient.name_en, 'พนักงาน') || ' · ' || payout_count || ' บิล'
      || case when coalesce(p_bonus, 0) > 0 then ' + โบนัส' else '' end,
    new_payout_id,
    actor.id
  );

  update public.commission_distributions d
  set paid_at = now(), payout_id = new_payout_id
  where d.bill_id = any(p_bill_ids)
    and d.user_id = p_staff_id
    and d.paid_at is null
    and d.reversed_at is null;

  return new_payout_id;
end;
$$;

revoke all on function public.pay_staff_commission(uuid, uuid[], text, text, integer) from public;
grant execute on function public.pay_staff_commission(uuid, uuid[], text, text, integer) to authenticated;

-- The Garage hourly payout used the same unsupported min(uuid) aggregate.
-- Patch the installed RPC in place, leaving its locking and atomic ledger flow intact.
do $$
declare
  function_sql text;
  old_expression constant text := 'min(h.branch_id)';
  new_expression constant text := '(array_agg(distinct h.branch_id order by h.branch_id))[1]';
begin
  select pg_get_functiondef('public.pay_garage_hourly_commission(uuid,uuid[],text,text)'::regprocedure)
  into function_sql;

  if function_sql is null or position(old_expression in function_sql) = 0 then
    raise exception 'Could not find the expected Garage hourly payout UUID aggregate';
  end if;

  execute replace(function_sql, old_expression, new_expression);
end;
$$;
