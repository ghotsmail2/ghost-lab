-- Garage technician commission policy. This is deliberately separate from
-- SABINAGISA's ON_WORK_ALL commission pool.

create or replace function public.garage_commission_period(p_clock_in timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when extract(hour from (p_clock_in at time zone 'Asia/Bangkok')) >= 18 then 'peak'
    else 'normal'
  end;
$$;

revoke all on function public.garage_commission_period(timestamptz) from public, anon;
grant execute on function public.garage_commission_period(timestamptz) to authenticated;

alter table public.attendance
  add column if not exists garage_commission_period text,
  add column if not exists garage_commission_amount integer;
alter table public.bills
  add column if not exists commission_policy text,
  add column if not exists commission_period text,
  add column if not exists commission_attendance_id uuid references public.attendance(id) on delete set null;
alter table public.commission_distributions
  add column if not exists commission_policy text,
  add column if not exists commission_period text,
  add column if not exists commission_attendance_id uuid references public.attendance(id) on delete set null;

-- Garage stays individual; SABINAGISA retains ON_WORK_ALL unchanged.
update public.branches
set commission_mode = 'INDIVIDUAL'
where key::text = 'garage' and commission_mode is distinct from 'INDIVIDUAL';

-- Snapshot the technician's actual clock-in class, not the time of a later bill.
update public.attendance a
set garage_commission_period = public.garage_commission_period(a.clock_in),
    garage_commission_amount = case
      when public.garage_commission_period(a.clock_in) = 'peak' then 15000 else 10000 end
from public.staff s
join public.branches b on b.id = s.primary_branch
where s.id = a.staff_id
  and b.key::text = 'garage'
  and s.role::text in ('head_mechanic', 'mechanic', 'mechanic_trainee')
  and a.branch_id = b.id
  and a.garage_commission_period is null;

-- Replace the atomic clock RPC with the same serialized behavior plus the
-- branch- and mechanic-scoped clock-in snapshot.
create or replace function public.clock_staff_attendance(p_action text)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.staff%rowtype;
  branch_key_value text;
  attendance_row public.attendance%rowtype;
  clock_in_value timestamptz;
  garage_period_value text;
  garage_amount_value integer;
begin
  select * into actor from public.staff
  where auth_user_id = auth.uid() and active = true;
  if not found then raise exception 'Active staff profile required' using errcode = '42501'; end if;
  if p_action not in ('clock_in', 'clock_out') then raise exception 'Invalid attendance action' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text, 0));
  select * into attendance_row from public.attendance
  where staff_id = actor.id and clock_out is null
  order by clock_in desc limit 1 for update;
  if p_action = 'clock_in' then
    if found then return attendance_row; end if;
    if actor.primary_branch is null then raise exception 'Primary branch is required' using errcode = '22023'; end if;
    select key::text into branch_key_value from public.branches where id = actor.primary_branch;
    clock_in_value := clock_timestamp();
    if branch_key_value = 'garage' and actor.role::text in ('head_mechanic', 'mechanic', 'mechanic_trainee') then
      garage_period_value := public.garage_commission_period(clock_in_value);
      garage_amount_value := case when garage_period_value = 'peak' then 15000 else 10000 end;
    end if;
    insert into public.attendance (
      staff_id, branch_id, clock_in, garage_commission_period, garage_commission_amount
    ) values (
      actor.id, actor.primary_branch, clock_in_value, garage_period_value, garage_amount_value
    ) returning * into attendance_row;
    return attendance_row;
  end if;
  if not found then return null; end if;
  update public.attendance set clock_out = now(), clock_out_source = 'manual'
  where id = attendance_row.id returning * into attendance_row;
  return attendance_row;
end;
$$;
revoke all on function public.clock_staff_attendance(text) from public, anon;
grant execute on function public.clock_staff_attendance(text) to authenticated;

-- Capture a single policy on each bill. Garage mechanics are individual-only;
-- the restaurant pool remains identified by its existing branch mode.
create or replace function public.set_bill_commission_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_key_value text;
  staff_role_value text;
  attendance_row public.attendance%rowtype;
begin
  select key::text into branch_key_value from public.branches where id = new.branch_id;
  select role::text into staff_role_value from public.staff where id = new.staff_id;
  if branch_key_value = 'garage'
     and staff_role_value in ('head_mechanic', 'mechanic', 'mechanic_trainee') then
    new.commission_mode := 'INDIVIDUAL';
    new.commission_policy := 'garage_technician_clock_in';
    select * into attendance_row
    from public.attendance a
    where a.staff_id = new.staff_id
      and a.branch_id = new.branch_id
      and a.clock_in <= coalesce(new.completed_at, now())
      and (a.clock_out is null or a.clock_out > coalesce(new.completed_at, now()))
    order by a.clock_in desc, a.id
    limit 1;
    if found then
      new.commission_attendance_id := attendance_row.id;
      new.commission_period := coalesce(
        attendance_row.garage_commission_period,
        public.garage_commission_period(attendance_row.clock_in)
      );
    else
      new.commission_attendance_id := null;
      new.commission_period := null;
    end if;
  elsif branch_key_value = 'chill'
        and coalesce(new.commission_mode, 'ON_WORK_ALL') = 'ON_WORK_ALL' then
    new.commission_policy := 'sabinagisa_commission_pool';
    new.commission_period := null;
    new.commission_attendance_id := null;
  else
    new.commission_policy := coalesce(new.commission_policy, 'branch_individual');
    new.commission_period := null;
    new.commission_attendance_id := null;
  end if;
  return new;
end;
$$;
revoke all on function public.set_bill_commission_policy_snapshot() from public, anon, authenticated;
drop trigger if exists bills_set_commission_policy_snapshot on public.bills;
create trigger bills_set_commission_policy_snapshot
before insert on public.bills
for each row execute function public.set_bill_commission_policy_snapshot();

-- Copy the bill snapshot onto its immutable payout-history rows. This does not
-- alter amounts or recipients produced by either existing materializer.
create or replace function public.set_distribution_commission_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select b.commission_policy, b.commission_period, b.commission_attendance_id
  into new.commission_policy, new.commission_period, new.commission_attendance_id
  from public.bills b where b.id = new.bill_id;
  return new;
end;
$$;
revoke all on function public.set_distribution_commission_policy_snapshot() from public, anon, authenticated;
drop trigger if exists commission_distribution_policy_snapshot on public.commission_distributions;
create trigger commission_distribution_policy_snapshot
before insert on public.commission_distributions
for each row execute function public.set_distribution_commission_policy_snapshot();

-- Keep checkout server-authoritative. Patch only the existing individual
-- commission calculation; ON_WORK_ALL validation/materialization is untouched.
do $$
declare
  function_sql text;
  old_expected text := $old$
    expected_commission := case
      when bill_input.total > 0 and coalesce(actor.commission_eligible, true)
        then coalesce(branch_row.commission_flat, 0)::integer
      else 0
    end;
$old$;
  new_expected text := $new$
    if branch_row.key::text = 'garage'
       and actor.role::text in ('head_mechanic', 'mechanic', 'mechanic_trainee') then
      select * into garage_attendance
      from public.attendance a
      where a.staff_id = actor.id and a.branch_id = branch_row.id
        and a.clock_in <= clock_timestamp() and a.clock_out is null
      order by a.clock_in desc, a.id
      limit 1 for update;
      if found then
        garage_period_value := coalesce(
          garage_attendance.garage_commission_period,
          public.garage_commission_period(garage_attendance.clock_in)
        );
      end if;
      expected_commission := case
        when bill_input.total > 0 and coalesce(actor.commission_eligible, true) and found
          then case when garage_period_value = 'peak' then 15000 else 10000 end
        else 0
      end;
    else
      expected_commission := case
        when bill_input.total > 0 and coalesce(actor.commission_eligible, true)
          then coalesce(branch_row.commission_flat, 0)::integer
        else 0
      end;
    end if;
$new$;
begin
  select pg_get_functiondef('public.create_bill_with_items_atomic(uuid,jsonb,jsonb,uuid)'::regprocedure)
    into function_sql;
  if position('garage_period_value := coalesce' in function_sql) > 0 then return; end if;
  if position(old_expected in function_sql) = 0 then
    raise exception 'Could not safely patch atomic POS individual commission validation';
  end if;
  function_sql := replace(function_sql, '  expected_commission integer;',
    '  expected_commission integer;' || E'\n  garage_attendance public.attendance%rowtype;\n  garage_period_value text;');
  function_sql := replace(function_sql, old_expected, new_expected);
  execute function_sql;
end;
$$;

-- Update the existing preview RPC while preserving the current restaurant pool
-- algorithm byte-for-byte in behavior. Only garage technicians use this branch.
create or replace function public.preview_my_bill_commission(
  p_branch_id uuid,
  p_order_total integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  requester public.staff%rowtype;
  branch_row public.branches%rowtype;
  attendance_row public.attendance%rowtype;
  v_mode text;
  v_base integer := 0;
  v_pool integer := 0;
  v_count integer := 0;
  v_index integer;
  v_share integer := 0;
  v_remainder integer := 0;
  v_my_amount integer := 0;
  v_is_peak boolean := false;
  v_policy text := 'branch_individual';
  v_garage_period text;
begin
  if p_order_total is null or p_order_total < 0 then raise exception 'order_total must be non-negative'; end if;
  select * into requester from public.staff where auth_user_id = auth.uid() and active limit 1;
  if requester.id is null then raise exception 'active staff account not found'; end if;
  select * into branch_row from public.branches where id = p_branch_id;
  if branch_row.id is null then raise exception 'branch not found'; end if;
  if requester.primary_branch is distinct from p_branch_id
     and requester.role::text not in ('owner','god','ceo','accountant') then
    raise exception 'staff may only preview commission for their own branch';
  end if;
  v_mode := coalesce(branch_row.commission_mode, 'INDIVIDUAL');

  if v_mode = 'ON_WORK_ALL' then
    v_policy := 'sabinagisa_commission_pool';
    v_base := public.commission_pool_base(p_order_total);
    v_is_peak := public.commission_pool_is_peak(clock_timestamp(), 'Asia/Bangkok');
    v_pool := case when v_is_peak then (v_base * 5) / 4 else v_base end;
    with eligible as (
      select s.id, (row_number() over(order by s.id) - 1)::integer as snapshot_index
      from public.staff s
      join lateral (
        select a.id from public.attendance a
        where a.staff_id = s.id and a.branch_id = p_branch_id
          and a.clock_in <= clock_timestamp() and a.clock_out is null
        order by a.clock_in desc, a.id limit 1
      ) attendance_now on true
      where s.active and coalesce(s.commission_eligible, true) and s.primary_branch = p_branch_id
    ) select count(*)::integer, max(snapshot_index) filter (where id = requester.id)
      into v_count, v_index from eligible;
    if v_count > 0 then
      v_share := v_pool / v_count;
      v_remainder := mod(v_pool, v_count);
      if v_index is not null then v_my_amount := v_share + case when v_index < v_remainder then 1 else 0 end; end if;
    end if;
  elsif branch_row.key::text = 'garage'
        and requester.role::text in ('head_mechanic', 'mechanic', 'mechanic_trainee') then
    v_policy := 'garage_technician_clock_in';
    select * into attendance_row from public.attendance a
    where a.staff_id = requester.id and a.branch_id = branch_row.id
      and a.clock_in <= clock_timestamp() and a.clock_out is null
    order by a.clock_in desc, a.id limit 1;
    if found then
      v_garage_period := coalesce(attendance_row.garage_commission_period, public.garage_commission_period(attendance_row.clock_in));
      v_pool := coalesce(attendance_row.garage_commission_amount, case when v_garage_period = 'peak' then 15000 else 10000 end);
      if p_order_total > 0 and coalesce(requester.commission_eligible, true) then
        v_my_amount := v_pool;
        v_count := 1;
      end if;
      v_is_peak := v_garage_period = 'peak';
    end if;
  else
    v_pool := case when coalesce(requester.commission_eligible, true) then coalesce(branch_row.commission_flat, 0)::integer else 0 end;
    v_count := case when v_pool > 0 then 1 else 0 end;
    v_my_amount := case when p_order_total > 0 then v_pool else 0 end;
  end if;

  return jsonb_build_object(
    'mode', v_mode, 'policy', v_policy, 'orderTotal', p_order_total,
    'basePool', v_base, 'finalPool', v_pool, 'activeCount', v_count,
    'isPeak', v_is_peak, 'garagePeriod', v_garage_period,
    'garageAttendanceId', attendance_row.id, 'myAmount', v_my_amount
  );
end;
$$;
revoke all on function public.preview_my_bill_commission(uuid,integer) from public, anon;
grant execute on function public.preview_my_bill_commission(uuid,integer) to authenticated;
