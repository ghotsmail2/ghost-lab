-- SABINAGISA commission pool v1.
-- New bills are calculated once from their database creation time. Existing
-- bills are explicitly marked legacy and are never reconstructed from today's
-- attendance data.

alter table public.bills
  add column if not exists first_order_time timestamptz,
  add column if not exists commission_timezone text,
  add column if not exists commission_order_total integer,
  add column if not exists commission_is_peak boolean,
  add column if not exists commission_base_pool integer,
  add column if not exists commission_peak_multiplier numeric(5,2),
  add column if not exists commission_final_pool integer,
  add column if not exists commission_active_count integer,
  add column if not exists commission_active_snapshot jsonb,
  add column if not exists commission_per_person numeric(14,4),
  add column if not exists commission_remainder integer,
  add column if not exists commission_calculation_version text,
  add column if not exists commission_calculation_status text,
  add column if not exists commission_calculated_at timestamptz;

alter table public.bills drop constraint if exists bills_commission_order_total_check;
alter table public.bills add constraint bills_commission_order_total_check
  check (commission_order_total is null or commission_order_total >= 0);
alter table public.bills drop constraint if exists bills_commission_active_count_check;
alter table public.bills add constraint bills_commission_active_count_check
  check (commission_active_count is null or commission_active_count >= 0);
alter table public.bills drop constraint if exists bills_commission_pool_check;
alter table public.bills add constraint bills_commission_pool_check
  check (
    (commission_base_pool is null or commission_base_pool >= 0)
    and (commission_final_pool is null or commission_final_pool >= 0)
    and (commission_remainder is null or commission_remainder >= 0)
  );
alter table public.bills drop constraint if exists bills_commission_calculation_status_check;
alter table public.bills add constraint bills_commission_calculation_status_check
  check (commission_calculation_status is null or commission_calculation_status in
    ('legacy_unavailable','calculated','no_active_employee','reversed'));

alter table public.commission_distributions
  add column if not exists calculation_version text,
  add column if not exists snapshot_index integer,
  add column if not exists remainder_amount integer not null default 0;

alter table public.commission_distributions drop constraint if exists commission_distributions_snapshot_index_check;
alter table public.commission_distributions add constraint commission_distributions_snapshot_index_check
  check (snapshot_index is null or snapshot_index >= 0);
alter table public.commission_distributions drop constraint if exists commission_distributions_remainder_check;
alter table public.commission_distributions add constraint commission_distributions_remainder_check
  check (remainder_amount in (0, 1));

create index if not exists bills_commission_first_order_idx
  on public.bills(first_order_time desc)
  where first_order_time is not null;
create index if not exists bills_commission_version_idx
  on public.bills(commission_calculation_version, commission_calculation_status);

create table if not exists public.commission_calculation_audit (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  actor_id uuid references public.staff(id) on delete set null,
  action text not null check (action in ('manual_recalculate')),
  reason text not null,
  old_value jsonb not null,
  new_value jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists commission_calculation_audit_bill_idx
  on public.commission_calculation_audit(bill_id, created_at desc);
alter table public.commission_calculation_audit enable row level security;
drop policy if exists commission_calculation_audit_read on public.commission_calculation_audit;
create policy commission_calculation_audit_read
  on public.commission_calculation_audit for select to authenticated
  using (exists (
    select 1 from public.staff s
    where s.auth_user_id = auth.uid()
      and s.role::text in ('owner','god','accountant')
  ));

create or replace function public.commission_pool_base(p_order_total numeric)
returns integer
language plpgsql immutable
set search_path = public
as $$
begin
  if p_order_total is null or p_order_total < 0 then
    raise exception 'order_total must be a non-negative number';
  end if;
  return case
    when p_order_total < 800 then 0
    when p_order_total < 1600 then 300
    when p_order_total < 2400 then 600
    when p_order_total < 4800 then 1000
    when p_order_total < 7200 then 2000
    else 3000
  end;
end;
$$;

create or replace function public.commission_pool_is_peak(
  p_first_order_time timestamptz,
  p_timezone text default 'Asia/Bangkok'
)
returns boolean
language plpgsql stable
set search_path = public
as $$
declare local_time time;
begin
  if p_first_order_time is null then
    raise exception 'first_order_time is required';
  end if;
  if p_timezone is null or not exists(select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone: %', coalesce(p_timezone, '<null>');
  end if;
  local_time := (p_first_order_time at time zone p_timezone)::time;
  return local_time >= time '18:00:00';
end;
$$;

-- Freeze all rows that predate this migration. No recipients are guessed and
-- no existing distribution or amount is changed.
update public.bills
set commission_calculation_version = 'legacy-v1',
    commission_calculation_status = 'legacy_unavailable'
where commission_calculation_version is null
  and (
    status::text in ('approved','paid')
    or exists(select 1 from public.commission_distributions d where d.bill_id = bills.id)
  );

create or replace function public.set_bill_commission_mode()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare branch_mode text;
begin
  if new.commission_mode is null or new.commission_mode = 'INDIVIDUAL' then
    select coalesce(commission_mode, 'INDIVIDUAL')
      into branch_mode
    from public.branches
    where id = new.branch_id;
    if branch_mode is not null then new.commission_mode := branch_mode; end if;
  end if;

  if tg_op = 'INSERT' then
    -- Database time is authoritative so a client cannot move an order into or
    -- out of Peak. The timestamp is never changed after insert.
    new.first_order_time := coalesce(new.created_at, clock_timestamp());
  end if;

  if new.status::text in ('approved','paid')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and new.completed_at is null then
    new.completed_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists bills_set_commission_mode on public.bills;
create trigger bills_set_commission_mode
before insert or update of branch_id, commission_mode, status on public.bills
for each row execute function public.set_bill_commission_mode();

create or replace function public.calculate_bill_commission_pool(
  p_bill_id uuid,
  p_force boolean default false
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  b public.bills%rowtype;
  v_timezone constant text := 'Asia/Bangkok';
  v_version constant text := 'pool-v1';
  v_base integer;
  v_final integer;
  v_peak boolean;
  v_count integer;
  v_share integer;
  v_remainder integer;
  v_snapshot jsonb := '[]'::jsonb;
  v_row record;
begin
  select * into b from public.bills where id = p_bill_id for update;
  if b.id is null then raise exception 'bill not found'; end if;
  if b.total is null or b.total < 0 then raise exception 'order_total must be non-negative'; end if;
  if b.first_order_time is null then raise exception 'first_order_time is required'; end if;
  if b.status::text in ('rejected','cancelled') then return 0; end if;

  -- Other branches keep their original individual commission behavior.
  if b.commission_mode <> 'ON_WORK_ALL' then
    if b.commission_mode = 'INDIVIDUAL' and b.commission > 0 then
      insert into public.commission_distributions(
        bill_id,user_id,user_name_snapshot,amount,commission_mode,created_at
      )
      select b.id,s.id,s.name_en,b.commission,'INDIVIDUAL',coalesce(b.completed_at,b.created_at,clock_timestamp())
      from public.staff s
      where s.id=b.staff_id and s.active and coalesce(s.commission_eligible,true)
      on conflict(bill_id,user_id) do nothing;
    end if;
    return (select count(*) from public.commission_distributions d where d.bill_id=b.id and d.reversed_at is null);
  end if;

  if not p_force and b.commission_calculation_version = v_version
     and b.commission_calculation_status in ('calculated','no_active_employee') then
    return coalesce(b.commission_active_count, 0);
  end if;
  if not p_force and b.commission_calculation_version like 'legacy%' then
    return 0;
  end if;
  if p_force and exists(
    select 1 from public.commission_distributions d
    where d.bill_id=b.id and d.paid_at is not null and d.reversed_at is null
  ) then
    raise exception 'paid commission cannot be recalculated';
  end if;

  v_base := public.commission_pool_base(b.total);
  v_peak := public.commission_pool_is_peak(b.first_order_time, v_timezone);
  v_final := case when v_peak then (v_base * 5) / 4 else v_base end;

  with eligible as (
    select s.id, s.name_en, a.id as attendance_id, a.clock_in, a.clock_out,
           row_number() over(order by s.id) - 1 as snapshot_index
    from public.staff s
    join lateral (
      select atn.id, atn.clock_in, atn.clock_out
      from public.attendance atn
      where atn.staff_id=s.id
        and atn.branch_id=b.branch_id
        and atn.clock_in <= b.first_order_time
        and (atn.clock_out is null or atn.clock_out > b.first_order_time)
        and (atn.clock_out is null or atn.clock_out >= atn.clock_in)
      order by atn.clock_in desc, atn.id
      limit 1
    ) a on true
    where s.active
      and coalesce(s.commission_eligible,true)
      and s.primary_branch=b.branch_id
  )
  select count(*)::integer into v_count from eligible;

  v_share := case when v_count > 0 then v_final / v_count else 0 end;
  v_remainder := case when v_count > 0 then mod(v_final, v_count) else 0 end;

  with eligible as (
    select s.id, s.name_en, a.id as attendance_id, a.clock_in, a.clock_out,
           (row_number() over(order by s.id) - 1)::integer as snapshot_index
    from public.staff s
    join lateral (
      select atn.id, atn.clock_in, atn.clock_out
      from public.attendance atn
      where atn.staff_id=s.id
        and atn.branch_id=b.branch_id
        and atn.clock_in <= b.first_order_time
        and (atn.clock_out is null or atn.clock_out > b.first_order_time)
        and (atn.clock_out is null or atn.clock_out >= atn.clock_in)
      order by atn.clock_in desc, atn.id
      limit 1
    ) a on true
    where s.active
      and coalesce(s.commission_eligible,true)
      and s.primary_branch=b.branch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', id,
    'employee_name', name_en,
    'attendance_id', attendance_id,
    'clock_in', clock_in,
    'clock_out', clock_out,
    'snapshot_index', snapshot_index,
    'remainder_amount', case when snapshot_index < v_remainder then 1 else 0 end,
    'amount', v_share + case when snapshot_index < v_remainder then 1 else 0 end
  ) order by snapshot_index), '[]'::jsonb)
  into v_snapshot
  from eligible;

  if p_force then
    update public.commission_distributions
    set reversed_at=coalesce(reversed_at,clock_timestamp())
    where bill_id=b.id and reversed_at is null and paid_at is null;
  end if;

  if v_final > 0 then
    for v_row in
      select value as employee
      from jsonb_array_elements(v_snapshot)
    loop
      insert into public.commission_distributions(
        bill_id,user_id,user_name_snapshot,amount,commission_mode,created_at,
        calculation_version,snapshot_index,remainder_amount,reversed_at
      ) values (
        b.id,(v_row.employee->>'employee_id')::uuid,v_row.employee->>'employee_name',
        (v_row.employee->>'amount')::integer,'ON_WORK_ALL',b.first_order_time,
        v_version,(v_row.employee->>'snapshot_index')::integer,
        (v_row.employee->>'remainder_amount')::integer,null
      )
      on conflict(bill_id,user_id) do update set
        user_name_snapshot=excluded.user_name_snapshot,
        amount=excluded.amount,
        commission_mode=excluded.commission_mode,
        created_at=excluded.created_at,
        calculation_version=excluded.calculation_version,
        snapshot_index=excluded.snapshot_index,
        remainder_amount=excluded.remainder_amount,
        reversed_at=null
      where p_force and public.commission_distributions.paid_at is null;
    end loop;
  end if;

  update public.bills set
    commission=v_final,
    commission_timezone=v_timezone,
    commission_order_total=b.total,
    commission_is_peak=v_peak,
    commission_base_pool=v_base,
    commission_peak_multiplier=case when v_peak then 1.25 else 1.00 end,
    commission_final_pool=v_final,
    commission_active_count=v_count,
    commission_active_snapshot=v_snapshot,
    commission_per_person=case when v_count > 0 then v_final::numeric/v_count else 0 end,
    commission_remainder=v_remainder,
    commission_calculation_version=v_version,
    commission_calculation_status=case when v_count=0 then 'no_active_employee' else 'calculated' end,
    commission_calculated_at=clock_timestamp()
  where id=b.id;

  return v_count;
end;
$$;

revoke all on function public.calculate_bill_commission_pool(uuid,boolean) from public;

create or replace function public.materialize_bill_commission(p_bill_id uuid)
returns integer
language sql security definer
set search_path = public
as $$
  select public.calculate_bill_commission_pool(p_bill_id, false);
$$;
revoke all on function public.materialize_bill_commission(uuid) from public;
grant execute on function public.materialize_bill_commission(uuid) to authenticated;

create or replace function public.admin_recalculate_bill_commission(
  p_bill_id uuid,
  p_reason text
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor public.staff%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_count integer;
begin
  select * into v_actor from public.staff where auth_user_id=auth.uid();
  if v_actor.id is null or v_actor.role::text not in ('owner','god') then
    raise exception 'not authorized';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'reason is required'; end if;

  perform 1 from public.bills where id=p_bill_id for update;
  if not found then raise exception 'bill not found'; end if;

  select jsonb_build_object(
    'bill',to_jsonb(b),
    'distributions',coalesce((select jsonb_agg(to_jsonb(d) order by d.snapshot_index,d.user_id)
      from public.commission_distributions d where d.bill_id=b.id),'[]'::jsonb)
  ) into v_old from public.bills b where b.id=p_bill_id;

  update public.bills set
    commission_calculation_version=null,
    commission_calculation_status=null
  where id=p_bill_id;
  v_count := public.calculate_bill_commission_pool(p_bill_id,true);

  select jsonb_build_object(
    'bill',to_jsonb(b),
    'distributions',coalesce((select jsonb_agg(to_jsonb(d) order by d.snapshot_index,d.user_id)
      from public.commission_distributions d where d.bill_id=b.id),'[]'::jsonb)
  ) into v_new from public.bills b where b.id=p_bill_id;

  insert into public.commission_calculation_audit(bill_id,actor_id,action,reason,old_value,new_value)
  values(p_bill_id,v_actor.id,'manual_recalculate',btrim(p_reason),v_old,v_new);
  return v_count;
end;
$$;
revoke all on function public.admin_recalculate_bill_commission(uuid,text) from public;
grant execute on function public.admin_recalculate_bill_commission(uuid,text) to authenticated;

create or replace function public.create_bill_commission_distributions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status::text in ('approved','paid')
     and (tg_op='INSERT' or old.status is distinct from new.status)
     and (new.commission_mode='ON_WORK_ALL' or new.commission>0) then
    perform public.materialize_bill_commission(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists bills_create_commission_distributions on public.bills;
create trigger bills_create_commission_distributions
after insert or update of status on public.bills
for each row execute function public.create_bill_commission_distributions();

create or replace function public.reverse_bill_commission_distributions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status::text in ('rejected','cancelled')
     and old.status::text is distinct from new.status::text then
    update public.commission_distributions
    set reversed_at=coalesce(reversed_at,clock_timestamp())
    where bill_id=new.id and reversed_at is null and paid_at is null;
    update public.bills
    set commission_calculation_status='reversed'
    where id=new.id and commission_calculation_version='pool-v1';
  end if;
  return new;
end;
$$;

comment on column public.bills.first_order_time is 'Immutable database-captured order entry time used for Peak and attendance snapshot.';
comment on column public.bills.commission_active_snapshot is 'Immutable eligible staff snapshot and deterministic per-person allocation.';
comment on function public.admin_recalculate_bill_commission(uuid,text) is 'Owner/GOD-only explicit recalculation with before/after audit; refuses paid distributions.';
