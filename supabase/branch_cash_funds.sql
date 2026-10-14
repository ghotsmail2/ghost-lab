-- Split the former shared cash ledger by branch. Historical rows are linked
-- back to their source transactions where possible; unlinked legacy rows stay
-- unassigned instead of being guessed into either branch.
alter table public.cash_ledger
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists cash_ledger_branch_created_idx
  on public.cash_ledger(branch_id, created_at desc);

-- Allow source attribution updates without treating them as financial edits in
-- already-closed periods. All other closed-period protections remain intact.
create or replace function public.protect_closed_finance_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_at timestamptz; new_at timestamptz;
begin
  if tg_table_name = 'cash_ledger' and tg_op = 'UPDATE'
     and (to_jsonb(old) - 'branch_id') = (to_jsonb(new) - 'branch_id') then
    return new;
  end if;
  if tg_table_name = 'expenses' then
    if tg_op <> 'INSERT' and old.status::text = 'paid' then old_at := coalesce(old.paid_at, old.created_at); end if;
    if tg_op <> 'DELETE' and new.status::text = 'paid' then new_at := coalesce(new.paid_at, new.created_at); end if;
  elsif tg_table_name = 'commission_payouts' then
    if tg_op <> 'INSERT' then old_at := old.paid_at; end if;
    if tg_op <> 'DELETE' then new_at := new.paid_at; end if;
  else
    if tg_op <> 'INSERT' then old_at := old.created_at; end if;
    if tg_op <> 'DELETE' then new_at := new.created_at; end if;
  end if;
  if old_at is not null and public.finance_date_is_closed(old_at) then
    raise exception 'ช่วงวันที่นี้ปิดรอบแล้ว ไม่สามารถแก้ไขหรือลบรายการได้';
  end if;
  if new_at is not null and public.finance_date_is_closed(new_at) then
    raise exception 'ช่วงวันที่นี้ปิดรอบแล้ว ไม่สามารถเพิ่มหรือย้ายรายการเข้าช่วงนี้ได้';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

-- Backfill source-linked transactions. Opening balances and old manual
-- adjustments cannot be safely assigned without an Owner's decision.
update public.cash_ledger ledger set branch_id = source.branch_id
from public.bills source where ledger.branch_id is null and ledger.bill_id = source.id;
update public.cash_ledger ledger set branch_id = source.branch_id
from public.expenses source where ledger.branch_id is null and ledger.expense_id = source.id;
update public.cash_ledger ledger set branch_id = source.branch_id
from public.commission_payouts source where ledger.branch_id is null and ledger.commission_payout_id = source.id;
update public.cash_ledger ledger set branch_id = member_row.branch_id
from public.member_memberships membership
join public.members member_row on member_row.id = membership.member_id
where ledger.branch_id is null and ledger.membership_id = membership.id and member_row.branch_id is not null;
update public.cash_ledger ledger set branch_id = staff_row.primary_branch
from public.pay_periods payment
join public.staff staff_row on staff_row.id = payment.staff_id
where ledger.branch_id is null and ledger.pay_period_id = payment.id and staff_row.primary_branch is not null;

-- Fill branch_id for new source-linked ledger entries, including payroll and
-- commission payouts. Explicit branch_id (manual adjustments) is preserved.
create or replace function public.assign_cash_ledger_branch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.branch_id is not null then return new; end if;
  if new.bill_id is not null then select branch_id into new.branch_id from public.bills where id = new.bill_id; end if;
  if new.branch_id is null and new.expense_id is not null then select branch_id into new.branch_id from public.expenses where id = new.expense_id; end if;
  if new.branch_id is null and new.commission_payout_id is not null then select branch_id into new.branch_id from public.commission_payouts where id = new.commission_payout_id; end if;
  if new.branch_id is null and new.membership_id is not null then
    select member_row.branch_id into new.branch_id from public.member_memberships membership
    join public.members member_row on member_row.id = membership.member_id where membership.id = new.membership_id;
  end if;
  if new.branch_id is null and new.pay_period_id is not null then
    select staff_row.primary_branch into new.branch_id from public.pay_periods payment
    join public.staff staff_row on staff_row.id = payment.staff_id where payment.id = new.pay_period_id;
  end if;
  return new;
end; $$;

drop trigger if exists cash_ledger_assign_branch on public.cash_ledger;
create trigger cash_ledger_assign_branch before insert or update on public.cash_ledger
for each row execute function public.assign_cash_ledger_branch();

create or replace function public.record_bill_income()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total <> 0 then
    insert into public.cash_ledger(entry_type, amount, description, bill_id, created_by, branch_id)
    values ('bill_income', new.total, 'รายรับจากบิล ' || new.bill_number, new.id, new.staff_id, new.branch_id)
    on conflict (bill_id) do nothing;
  end if;
  return new;
end; $$;

create or replace function public.record_membership_income()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_branch uuid;
begin
  select branch_id into member_branch from public.members where id = new.member_id;
  if new.total_paid > 0 then
    insert into public.cash_ledger(entry_type, amount, description, membership_id, branch_id)
    values ('membership_income', new.total_paid,
      'ค่าสมาชิก ' || initcap(new.tier) || ' · ' || new.months || ' เดือน', new.id, member_branch)
    on conflict (membership_id) do nothing;
  end if;
  return new;
end; $$;

create or replace function public.record_paid_expense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'paid' then
    insert into public.cash_ledger(entry_type, amount, description, expense_id, created_by, branch_id)
    values ('purchase', -new.amount, new.description, new.id, new.staff_id, new.branch_id)
    on conflict (expense_id) do update set amount = excluded.amount,
      description = excluded.description, created_by = excluded.created_by, branch_id = excluded.branch_id;
  elsif tg_op = 'UPDATE' and old.status::text = 'paid' then
    delete from public.cash_ledger where expense_id = new.id;
  end if;
  return new;
end; $$;

-- Adjust the selected branch's fund, never a shared unassigned pool.
drop function if exists public.record_cash_adjustment(integer, text);
create or replace function public.record_cash_adjustment(
  p_branch_id uuid, p_amount integer, p_description text
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare adjustment_id uuid; actor public.staff%rowtype; description_input text := nullif(btrim(p_description), '');
begin
  select * into actor from public.staff where auth_user_id = auth.uid() and active = true;
  if not found or actor.role::text not in ('owner', 'god') then
    raise exception 'Active Owner or GOD account required' using errcode = '42501';
  end if;
  if p_branch_id is null or not exists (select 1 from public.branches where id = p_branch_id) then
    raise exception 'กรุณาเลือกสาขาของเงินกลาง';
  end if;
  if p_amount is null or p_amount = 0 or description_input is null or length(description_input) > 500 then
    raise exception 'กรอกรายละเอียดและยอดเงินที่ไม่เป็นศูนย์';
  end if;
  insert into public.cash_ledger(entry_type, amount, description, created_by, branch_id)
  values ('manual_adjustment', p_amount, description_input, actor.id, p_branch_id)
  returning id into adjustment_id;
  return adjustment_id;
end; $$;
revoke all on function public.record_cash_adjustment(uuid, integer, text) from public, anon;
grant execute on function public.record_cash_adjustment(uuid, integer, text) to authenticated;
