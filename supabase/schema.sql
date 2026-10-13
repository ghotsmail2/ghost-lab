-- =========================================================
-- GHOST LAB — Supabase Schema v1
-- Branches: garage (Ghost Lab Garage), chill (Ghost Chill)
-- =========================================================

-- ---------- ENUMS ----------
create type branch_key as enum ('garage', 'chill');

create type staff_role as enum (
  'owner',            -- full access, all branches
  'head_mechanic',    -- garage: team oversight + approvals
  'mechanic',         -- garage: POS + own commission
  'mechanic_trainee', -- garage: limited POS, needs approval
  'chill_manager',    -- chill: team oversight + approvals
  'chill_staff',      -- chill: POS + own commission
  'stock_keeper',     -- stock page only, both branches
  'accountant'        -- expenses/pay periods, read-only elsewhere
);

create type bill_status as enum ('pending_approval', 'approved', 'rejected', 'paid');
create type pay_status as enum ('open', 'pending', 'paid');

-- ---------- CORE TABLES ----------

create table branches (
  id            uuid primary key default gen_random_uuid(),
  key           branch_key not null unique,     -- 'garage' | 'chill'
  name          text not null,                  -- 'Ghost Lab Garage' | 'Ghost Chill'
  commission_flat  integer default 3000,         -- flat commission per bill, same model both branches
  created_at    timestamptz default now()
);

create table staff (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) unique, -- links to Supabase auth
  name_en       text not null,          -- login name
  name_th       text,                   -- IC/display name
  pin_hash      text not null,          -- hashed PIN, never store plain
  role          staff_role not null,
  primary_branch uuid references branches(id),
  active        boolean default true,
  avatar_color  text,                   -- for UI avatar gradient
  created_at    timestamptz default now()
);

-- who reports to whom — needed for "own vs team" visibility scoping
create table staff_supervisors (
  staff_id       uuid references staff(id) on delete cascade,
  supervisor_id  uuid references staff(id) on delete cascade,
  primary key (staff_id, supervisor_id)
);

create table services (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) not null,
  category      text not null,          -- 'Body Part', 'Food', etc.
  name          text not null,
  price         integer not null,
  active        boolean default true,
  created_at    timestamptz default now()
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id),
  name          text not null,
  phone         text,
  plate_or_note text,
  tier          text default 'regular', -- regular / silver / gold / xkate_origin-style
  membership_started_at timestamptz,
  membership_expires_at timestamptz,
  membership_fee integer,
  total_spent   integer default 0,
  visits        integer default 0,
  created_at    timestamptz default now()
);

create table member_memberships (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid references members(id) on delete cascade not null,
  tier          text not null check (tier in ('regular', 'silver', 'gold')),
  monthly_fee   integer not null check (monthly_fee >= 0),
  months        integer not null default 1 check (months > 0),
  total_paid    integer not null default 0 check (total_paid >= 0),
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create table bills (
  id              uuid primary key default gen_random_uuid(),
  bill_number     text not null unique,     -- e.g. GRG-1719
  branch_id       uuid references branches(id) not null,
  staff_id        uuid references staff(id) not null,   -- who opened it
  member_id       uuid references members(id),
  plate           text,
  vehicle         text,
  notes           text,
  subtotal        integer not null default 0,
  commission      integer not null default 0,
  discount_pct    numeric(5,2) default 0,
  total           integer not null default 0,
  status          bill_status not null default 'approved',
  approved_by     uuid references staff(id),  -- filled if it needed approval
  created_at      timestamptz default now()
);

create table bill_items (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid references bills(id) on delete cascade,
  service_id    uuid references services(id),
  name_snapshot text not null,   -- freeze name/price at time of sale
  price_snapshot integer not null
);

create table attendance (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid references staff(id) not null,
  branch_id     uuid references branches(id) not null,
  clock_in      timestamptz not null default now(),
  clock_out     timestamptz,
  clock_out_source text not null default 'manual' check (clock_out_source in ('manual', 'logout', 'stale_timeout'))
);

create table stock_items (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) not null,
  category      text not null,      -- 'วัตถุดิบ' / 'Material'
  name          text not null,
  quantity      integer not null default 0,
  unit          text,
  low_stock_threshold integer default 0,
  updated_by    uuid references staff(id),
  updated_at    timestamptz default now()
);

create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  stock_item_id uuid references stock_items(id) on delete cascade,
  staff_id      uuid references staff(id),
  change        integer not null,   -- +in / -out
  reason        text,
  bill_id       uuid references bills(id),  -- set when auto-deducted from a sale
  created_at    timestamptz default now()
);

-- ---------- SERVICE ↔ MATERIALS (Bill of Materials) ----------
-- Links a service to the stock items it consumes per sale, e.g.
-- "Comfort Tires" consumes 2 units of RUBBER + 1 unit of VALVE.
-- On bill_items insert, a trigger/edge-function deducts these from stock_items.
create table service_materials (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid references services(id) on delete cascade,
  stock_item_id uuid references stock_items(id) on delete cascade,
  qty_per_unit  integer not null default 1,
  unique (service_id, stock_item_id)
);

create table expenses (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id),
  category      text not null,       -- วัตถุดิบ / อุปกรณ์ / ค่าเช่า
  description   text not null,
  amount        integer not null,
  staff_id      uuid references staff(id),  -- who logged it
  status        pay_status default 'pending',
  paid_at       timestamptz,
  created_at    timestamptz default now()
);

create table pay_periods (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid references staff(id) not null,
  period_start  date not null,
  period_end    date not null,
  amount        integer not null default 0,
  status        pay_status not null default 'open',
  paid_at       timestamptz,
  paid_by       uuid references staff(id)   -- accountant/owner who marked it paid
);

-- ---------- APPROVAL FLOW (NOT ACTIVE YET) ----------
-- Table exists for future use, but no thresholds are set and bills default to
-- 'approved' status on creation — every bill closes freely for now.
-- To turn this on later: insert a row here per branch and switch the bill
-- insert logic to check against it before setting status.
create table approval_rules (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) not null,
  max_bill_amount integer,       -- bills above this need approval (NULL = disabled)
  max_discount_pct numeric(5,2) -- discounts above this need approval (NULL = disabled)
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table staff enable row level security;
alter table branches enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;
alter table attendance enable row level security;
alter table stock_items enable row level security;
alter table expenses enable row level security;
alter table pay_periods enable row level security;
alter table services enable row level security;
alter table members enable row level security;
alter table member_memberships enable row level security;
alter table service_materials enable row level security;

-- Helper: get requester's staff row
create or replace function my_staff()
returns staff as $$
  select * from staff where auth_user_id = auth.uid();
$$ language sql stable;

-- Helper: is requester a manager-tier role for a given branch's function
create or replace function is_branch_lead(target_branch uuid)
returns boolean as $$
  select exists (
    select 1 from staff s
    where s.auth_user_id = auth.uid()
    and (
      s.role = 'owner'
      or (s.role = 'head_mechanic' and s.primary_branch = target_branch)
      or (s.role = 'chill_manager' and s.primary_branch = target_branch)
    )
  );
$$ language sql stable;

-- ---- BRANCHES: public read (needed pre-login on Login/Signup screens) ----
create policy branches_read_all on branches for select using (true);

-- ---- STAFF: everyone can read active staff directory (for login screen); only owner edits ----
create policy staff_read_all on staff for select using (true);

-- NOTE: these are split into insert/update/delete (not "for all") on purpose —
-- a "for all" policy also applies to SELECT, and since its check queries the
-- staff table again, that causes Postgres to recurse into itself (infinite
-- recursion / 500 error) on every plain staff read.
create policy staff_insert_owner on staff for insert with check (
  exists (select 1 from staff where auth_user_id = auth.uid() and role = 'owner')
);
create policy staff_update_owner on staff for update using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role = 'owner')
);
create policy staff_delete_owner on staff for delete using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role = 'owner')
);

-- Self-signup creates an active, low-privilege staff row. An owner can still
-- change its final role afterwards.
create policy staff_insert_self_signup on staff for insert with check (
  auth_user_id = auth.uid()
  and active = true
  and pin_hash = 'managed-by-supabase-auth'
  and (
    (role = 'mechanic_trainee' and exists (
      select 1 from branches where branches.id = primary_branch and branches.key = 'garage'
    ))
    or (role = 'chill_staff' and exists (
      select 1 from branches where branches.id = primary_branch and branches.key = 'chill'
    ))
  )
);

-- ---- SERVICES: readable by everyone logged in; editable by owner + branch lead ----
create policy services_read on services for select using (auth.uid() is not null);
create policy services_write on services for all using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role='owner')
  or is_branch_lead(branch_id)
);

-- ---- SERVICE MATERIALS: same access as the service they belong to ----
create policy service_materials_read on service_materials for select using (auth.uid() is not null);
create policy service_materials_write on service_materials for all using (
  exists (
    select 1 from services s
    where s.id = service_materials.service_id
    and (
      exists (select 1 from staff where auth_user_id = auth.uid() and role='owner')
      or is_branch_lead(s.branch_id)
    )
  )
);

-- ---- BILLS ----
-- Mechanic/chill_staff: can see + insert their OWN bills.
-- Head_mechanic/chill_manager: can see all bills for their branch.
-- Accountant/Owner: can see everything, but cannot INSERT (they don't open bills).
create policy bills_select on bills for select using (
  staff_id = (select id from staff where auth_user_id = auth.uid())
  or is_branch_lead(branch_id)
  or exists (select 1 from staff where auth_user_id = auth.uid() and role in ('owner','accountant'))
);

create policy bills_insert on bills for insert with check (
  staff_id = (select id from staff where auth_user_id = auth.uid())
  and exists (
    select 1 from staff where auth_user_id = auth.uid()
    and role in ('mechanic','mechanic_trainee','chill_staff','head_mechanic','chill_manager','owner')
  )
);

-- Only branch lead / owner can flip status (approve/reject) or mark paid
create policy bills_update_approval on bills for update using (
  is_branch_lead(branch_id)
  or exists (select 1 from staff where auth_user_id = auth.uid() and role = 'owner')
);

-- ---- BILL_ITEMS: visibility mirrors the parent bill ----
create policy bill_items_select on bill_items for select using (
  exists (
    select 1 from bills b
    where b.id = bill_items.bill_id
    and (
      b.staff_id = (select id from staff where auth_user_id = auth.uid())
      or is_branch_lead(b.branch_id)
      or exists (select 1 from staff where auth_user_id = auth.uid() and role in ('owner','accountant'))
    )
  )
);
create policy bill_items_insert on bill_items for insert with check (
  exists (
    select 1 from bills b
    where b.id = bill_items.bill_id
    and b.staff_id = (select id from staff where auth_user_id = auth.uid())
  )
);

-- ---- ATTENDANCE: staff manage their own clock in/out; leads + owner see branch/all ----
create policy attendance_own on attendance for all using (
  staff_id = (select id from staff where auth_user_id = auth.uid())
);
create policy attendance_view_branch on attendance for select using (
  is_branch_lead(branch_id)
  or exists (select 1 from staff where auth_user_id = auth.uid() and role in ('owner','accountant'))
);

-- Staff can see a branch-safe aggregate without receiving other employees'
-- attendance rows through the normal RLS query.
create or replace function count_on_shift_staff(p_branch_id uuid)
returns integer
security definer
set search_path = public, pg_temp
language plpgsql stable as $$
declare
  requester staff;
  result_count integer;
begin
  select * into requester from staff where auth_user_id = auth.uid() and active limit 1;
  if requester.id is null or p_branch_id is null then return 0; end if;
  if requester.role not in ('owner', 'god', 'accountant')
     and requester.primary_branch is distinct from p_branch_id then
    raise exception 'Staff may only view the on-shift count for their own branch';
  end if;

  select count(distinct a.staff_id)::integer into result_count
  from attendance a
  join staff s on s.id = a.staff_id
  where a.branch_id = p_branch_id
    and a.clock_out is null
    and s.active = true
    and s.primary_branch = p_branch_id;
  return coalesce(result_count, 0);
end;
$$;

revoke all on function count_on_shift_staff(uuid) from public;
grant execute on function count_on_shift_staff(uuid) to authenticated;

-- Staff can open a compact, branch-safe list of who is currently on shift.
create or replace function list_on_shift_staff(p_branch_id uuid default null)
returns table(
  id uuid,
  name_en text,
  branch_id uuid,
  branch_name text,
  clock_in timestamptz
)
security definer
set search_path = public, pg_temp
language plpgsql stable as $$
declare
  requester staff;
begin
  select * into requester from staff where auth_user_id = auth.uid() and active limit 1;
  if requester.id is null then return; end if;
  if p_branch_id is null and requester.role not in ('owner', 'god', 'accountant') then
    raise exception 'Staff may only view on-shift names for their own branch';
  end if;
  if p_branch_id is not null
     and requester.role not in ('owner', 'god', 'accountant')
     and requester.primary_branch is distinct from p_branch_id then
    raise exception 'Staff may only view on-shift names for their own branch';
  end if;

  return query
  select s.id, s.name_en, a.branch_id, br.name, a.clock_in
  from attendance a
  join staff s on s.id = a.staff_id
  left join branches br on br.id = a.branch_id
  where a.clock_out is null
    and s.active = true
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and s.primary_branch = a.branch_id
  order by a.clock_in asc, s.name_en asc;
end;
$$;

revoke all on function list_on_shift_staff(uuid) from public;
grant execute on function list_on_shift_staff(uuid) to authenticated;

-- ---- STOCK: only stock_keeper + owner can read/write ----
create policy stock_access on stock_items for all using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role in ('stock_keeper','owner'))
);

-- ---- EXPENSES: any logged-in staff can log/read; only accountant/owner mark paid or delete ----
create policy expenses_read on expenses for select using (auth.uid() is not null);
create policy expenses_insert on expenses for insert with check (
  staff_id = (select id from staff where auth_user_id = auth.uid())
);
create policy expenses_update on expenses for update using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role in ('accountant', 'owner'))
);
create policy expenses_delete on expenses for delete using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role in ('accountant', 'owner'))
);

-- ---- PAY PERIODS: staff see own; accountant/owner see + edit all ----
create policy pay_periods_own on pay_periods for select using (
  staff_id = (select id from staff where auth_user_id = auth.uid())
);
create policy pay_periods_finance on pay_periods for all using (
  exists (select 1 from staff where auth_user_id = auth.uid() and role in ('accountant','owner'))
);

-- ---- MEMBERS: readable + writable by anyone logged in (adding a walk-in
-- customer at the counter is a normal POS action for every staff member) ----
create policy members_read on members for select using (auth.uid() is not null);
create policy members_write on members for all using (auth.uid() is not null);
create policy member_memberships_read on member_memberships for select using (auth.uid() is not null);
create policy member_memberships_write on member_memberships for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Collaboration Membership system extensions are maintained in migration
-- 20261003_collaboration_membership_system.sql.
