-- Weekly closing and cash reconciliation for any selected date range.

create table if not exists public.weekly_closings (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'closed' check (status = 'closed'),
  sales_total integer not null default 0,
  cash_sales integer not null default 0,
  transfer_sales integer not null default 0,
  expense_total integer not null default 0,
  commission_generated integer not null default 0,
  commission_paid integer not null default 0,
  commission_pending integer not null default 0,
  opening_cash_balance integer not null default 0,
  closing_cash_balance integer not null default 0,
  expected_net_change integer not null default 0,
  counted_cash integer not null default 0,
  discrepancy integer not null default 0,
  bill_count integer not null default 0,
  expense_count integer not null default 0,
  payout_count integer not null default 0,
  branch_breakdown jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  note text,
  closed_by uuid references public.staff(id) on delete set null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint weekly_closings_period_check check (period_end >= period_start),
  constraint weekly_closings_period_unique unique (period_start, period_end)
);

create index if not exists weekly_closings_period_idx
  on public.weekly_closings(period_start desc, period_end desc);
alter table public.weekly_closings enable row level security;

drop policy if exists weekly_closings_finance_read on public.weekly_closings;
create policy weekly_closings_finance_read on public.weekly_closings
for select to authenticated using (exists (
  select 1 from public.staff s where s.auth_user_id = auth.uid() and s.active
    and s.role::text in ('owner', 'god', 'ceo', 'accountant')
));
drop policy if exists weekly_closings_owner_insert on public.weekly_closings;
create policy weekly_closings_owner_insert on public.weekly_closings
for insert to authenticated with check (exists (
  select 1 from public.staff s where s.auth_user_id = auth.uid() and s.active
    and s.role::text in ('owner', 'god')
));

create or replace function public.get_weekly_closing_preview(p_start date, p_end date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  actor public.staff%rowtype;
  start_at timestamptz;
  end_at timestamptz;
  result jsonb;
begin
  select * into actor from public.staff where auth_user_id = auth.uid() and active;
  if actor.id is null or actor.role::text not in ('owner', 'god', 'ceo', 'accountant') then
    raise exception 'ไม่มีสิทธิ์ดูข้อมูลปิดรอบ';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'ช่วงวันที่ไม่ถูกต้อง';
  end if;
  start_at := p_start::timestamp at time zone 'Asia/Bangkok';
  end_at := (p_end + 1)::timestamp at time zone 'Asia/Bangkok';

  with valid_bills as (
    select b.* from public.bills b
    where b.created_at >= start_at and b.created_at < end_at
      and b.status::text not in ('rejected', 'cancelled')
  ), paid_expenses as (
    select e.* from public.expenses e
    where e.status::text = 'paid'
      and coalesce(e.paid_at, e.created_at) >= start_at
      and coalesce(e.paid_at, e.created_at) < end_at
  ), period_distributions as (
    select d.* from public.commission_distributions d
    join valid_bills b on b.id = d.bill_id where d.reversed_at is null
  ), period_payouts as (
    select cp.* from public.commission_payouts cp
    where cp.paid_at >= start_at and cp.paid_at < end_at
  ), branch_rows as (
    select br.id, br.key::text as key, br.name,
      coalesce((select count(*) from valid_bills b where b.branch_id = br.id), 0)::integer as bill_count,
      coalesce((select sum(b.total) from valid_bills b where b.branch_id = br.id), 0)::integer as sales_total,
      coalesce((select sum(b.total) from valid_bills b where b.branch_id = br.id and b.payment_method::text <> 'transfer'), 0)::integer as cash_sales,
      coalesce((select sum(b.total) from valid_bills b where b.branch_id = br.id and b.payment_method::text = 'transfer'), 0)::integer as transfer_sales,
      coalesce((select sum(e.amount) from paid_expenses e where e.branch_id = br.id), 0)::integer as expense_total,
      coalesce((select sum(d.amount) from period_distributions d join valid_bills b on b.id = d.bill_id where b.branch_id = br.id), 0)::integer as commission_generated,
      coalesce((select sum(cp.total_amount) from period_payouts cp where cp.branch_id = br.id), 0)::integer as commission_paid
    from public.branches br
    where exists(select 1 from valid_bills b where b.branch_id = br.id)
       or exists(select 1 from paid_expenses e where e.branch_id = br.id)
       or exists(select 1 from period_payouts cp where cp.branch_id = br.id)
  ), totals as (
    select
      coalesce((select count(*) from valid_bills), 0)::integer as bill_count,
      coalesce((select sum(total) from valid_bills), 0)::integer as sales_total,
      coalesce((select sum(total) from valid_bills where payment_method::text <> 'transfer'), 0)::integer as cash_sales,
      coalesce((select sum(total) from valid_bills where payment_method::text = 'transfer'), 0)::integer as transfer_sales,
      coalesce((select count(*) from paid_expenses), 0)::integer as expense_count,
      coalesce((select sum(amount) from paid_expenses), 0)::integer as expense_total,
      coalesce((select sum(amount) from period_distributions), 0)::integer as commission_generated,
      coalesce((select sum(amount) from period_distributions where paid_at is null), 0)::integer as commission_pending,
      coalesce((select count(*) from period_payouts), 0)::integer as payout_count,
      coalesce((select sum(total_amount) from period_payouts), 0)::integer as commission_paid,
      coalesce((select sum(amount) from public.cash_ledger where created_at < start_at), 0)::integer as opening_cash_balance,
      coalesce((select sum(amount) from public.cash_ledger where created_at < end_at), 0)::integer as closing_cash_balance,
      coalesce((select count(*) from public.commission_payouts cp where not exists (
        select 1 from public.cash_ledger cl where cl.commission_payout_id = cp.id
      )), 0)::integer as unlinked_payout_count,
      coalesce((select sum(cp.total_amount) from public.commission_payouts cp where not exists (
        select 1 from public.cash_ledger cl where cl.commission_payout_id = cp.id
      )), 0)::integer as unlinked_payout_total
  )
  select jsonb_build_object(
    'period_start', p_start, 'period_end', p_end,
    'bill_count', t.bill_count, 'sales_total', t.sales_total,
    'cash_sales', t.cash_sales, 'transfer_sales', t.transfer_sales,
    'expense_count', t.expense_count, 'expense_total', t.expense_total,
    'commission_generated', t.commission_generated,
    'commission_paid', t.commission_paid, 'commission_pending', t.commission_pending,
    'payout_count', t.payout_count,
    'opening_cash_balance', t.opening_cash_balance,
    'closing_cash_balance', t.closing_cash_balance,
    'expected_net_change', t.closing_cash_balance - t.opening_cash_balance,
    'operating_net', t.sales_total - t.expense_total - t.commission_paid,
    'unlinked_payout_count', t.unlinked_payout_count,
    'unlinked_payout_total', t.unlinked_payout_total,
    'branch_breakdown', coalesce((select jsonb_agg(to_jsonb(br) order by br.name) from branch_rows br), '[]'::jsonb),
    'existing_closing', (select to_jsonb(wc) from public.weekly_closings wc
      where wc.period_start = p_start and wc.period_end = p_end limit 1)
  ) into result from totals t;
  return result;
end; $$;

revoke all on function public.get_weekly_closing_preview(date, date) from public;
grant execute on function public.get_weekly_closing_preview(date, date) to authenticated;

create or replace function public.close_weekly_period(
  p_start date, p_end date, p_counted_cash integer, p_note text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor public.staff%rowtype; preview jsonb; new_id uuid;
begin
  select * into actor from public.staff where auth_user_id = auth.uid() and active;
  if actor.id is null or actor.role::text not in ('owner', 'god') then
    raise exception 'Owner เท่านั้นที่ปิดรอบได้';
  end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'กรุณากรอกยอดเงินที่นับได้';
  end if;
  if exists(select 1 from public.weekly_closings where period_start = p_start and period_end = p_end) then
    raise exception 'ช่วงวันที่นี้ปิดรอบแล้ว';
  end if;
  preview := public.get_weekly_closing_preview(p_start, p_end);
  insert into public.weekly_closings (
    period_start, period_end, sales_total, cash_sales, transfer_sales,
    expense_total, commission_generated, commission_paid, commission_pending,
    opening_cash_balance, closing_cash_balance, expected_net_change,
    counted_cash, discrepancy, bill_count, expense_count, payout_count,
    branch_breakdown, snapshot, note, closed_by
  ) values (
    p_start, p_end,
    coalesce((preview->>'sales_total')::integer, 0),
    coalesce((preview->>'cash_sales')::integer, 0),
    coalesce((preview->>'transfer_sales')::integer, 0),
    coalesce((preview->>'expense_total')::integer, 0),
    coalesce((preview->>'commission_generated')::integer, 0),
    coalesce((preview->>'commission_paid')::integer, 0),
    coalesce((preview->>'commission_pending')::integer, 0),
    coalesce((preview->>'opening_cash_balance')::integer, 0),
    coalesce((preview->>'closing_cash_balance')::integer, 0),
    coalesce((preview->>'expected_net_change')::integer, 0),
    p_counted_cash,
    p_counted_cash - coalesce((preview->>'closing_cash_balance')::integer, 0),
    coalesce((preview->>'bill_count')::integer, 0),
    coalesce((preview->>'expense_count')::integer, 0),
    coalesce((preview->>'payout_count')::integer, 0),
    coalesce(preview->'branch_breakdown', '[]'::jsonb), preview,
    nullif(btrim(coalesce(p_note, '')), ''), actor.id
  ) returning id into new_id;
  return new_id;
end; $$;

revoke all on function public.close_weekly_period(date, date, integer, text) from public;
grant execute on function public.close_weekly_period(date, date, integer, text) to authenticated;

-- Old payouts are reconciled once, as an adjustment in the current period.
create or replace function public.reconcile_unlinked_commission_payouts(p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor public.staff%rowtype; inserted_count integer := 0; inserted_total integer := 0;
begin
  select * into actor from public.staff where auth_user_id = auth.uid() and active;
  if actor.id is null or actor.role::text not in ('owner', 'god') then
    raise exception 'Owner เท่านั้นที่ปรับยอดย้อนหลังได้';
  end if;
  with missing as (
    select cp.id, cp.total_amount, s.name_en
    from public.commission_payouts cp left join public.staff s on s.id = cp.staff_id
    where not exists (select 1 from public.cash_ledger cl where cl.commission_payout_id = cp.id)
    for update of cp
  ), inserted as (
    insert into public.cash_ledger(entry_type, amount, description, commission_payout_id, created_by)
    select 'commission_payout', -m.total_amount,
      'ปรับยอดค่าคอมเก่า · ' || coalesce(m.name_en, 'พนักงาน')
        || case when nullif(btrim(coalesce(p_note, '')), '') is not null then ' · ' || btrim(p_note) else '' end,
      m.id, actor.id from missing m
    on conflict (commission_payout_id) where commission_payout_id is not null do nothing
    returning amount
  )
  select count(*)::integer, coalesce(sum(abs(amount)), 0)::integer
    into inserted_count, inserted_total from inserted;
  return jsonb_build_object('count', inserted_count, 'total', inserted_total);
end; $$;

revoke all on function public.reconcile_unlinked_commission_payouts(text) from public;
grant execute on function public.reconcile_unlinked_commission_payouts(text) to authenticated;

create or replace function public.finance_date_is_closed(p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.weekly_closings wc
    where (p_at at time zone 'Asia/Bangkok')::date between wc.period_start and wc.period_end
  );
$$;

create or replace function public.protect_closed_finance_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_at timestamptz; new_at timestamptz;
begin
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

drop trigger if exists bills_protect_closed_period on public.bills;
create trigger bills_protect_closed_period before insert or update or delete on public.bills
for each row execute function public.protect_closed_finance_period();
drop trigger if exists expenses_protect_closed_period on public.expenses;
create trigger expenses_protect_closed_period before insert or update or delete on public.expenses
for each row execute function public.protect_closed_finance_period();
drop trigger if exists cash_ledger_protect_closed_period on public.cash_ledger;
create trigger cash_ledger_protect_closed_period before insert or update or delete on public.cash_ledger
for each row execute function public.protect_closed_finance_period();
drop trigger if exists commission_payouts_protect_closed_period on public.commission_payouts;
create trigger commission_payouts_protect_closed_period before insert or update or delete on public.commission_payouts
for each row execute function public.protect_closed_finance_period();

comment on table public.weekly_closings is
  'Immutable finance snapshots for selected ranges, normally Monday-Sunday.';
