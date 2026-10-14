-- Garage technicians retain the Garage per-bill rate (¥3,000).
-- Each completed 60-minute block earns ¥10,000; blocks starting at
-- 18:00–22:59 Bangkok earn ¥15,000. SABINAGISA's pool is unchanged.

create table if not exists public.garage_technician_hourly_commissions (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  hour_index integer not null check (hour_index > 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount integer not null check (amount in (10000,15000)),
  payout_id uuid references public.commission_payouts(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attendance_id,hour_index),
  check (period_end=period_start+interval '1 hour')
);
create index if not exists garage_hourly_commissions_unpaid_idx
  on public.garage_technician_hourly_commissions(branch_id,staff_id,period_end) where paid_at is null;
alter table public.garage_technician_hourly_commissions enable row level security;
revoke all on public.garage_technician_hourly_commissions from public,anon,authenticated;
grant select on public.garage_technician_hourly_commissions to authenticated;
drop policy if exists garage_hourly_commissions_read on public.garage_technician_hourly_commissions;
create policy garage_hourly_commissions_read on public.garage_technician_hourly_commissions for select to authenticated using (
  exists(select 1 from public.staff actor where actor.auth_user_id=auth.uid() and actor.active
    and (actor.id=garage_technician_hourly_commissions.staff_id or actor.role::text in ('owner','god','accountant')))
);

-- Idempotent materializer; a unique attendance/hour key prevents duplicates.
create or replace function public.materialize_garage_technician_hours(p_attendance_id uuid default null)
returns integer language plpgsql security definer set search_path=public as $$
declare
  actor public.staff%rowtype; a public.attendance%rowtype; branch_key_value text;
  cutoff_value timestamptz; completed_hours integer; inserted_count integer:=0;
  row_count_value integer; hour_number integer; period_start_value timestamptz; period_hour integer;
begin
  select * into actor from public.staff where auth_user_id=auth.uid() and active;
  if actor.id is null then raise exception 'Active staff profile required' using errcode='42501'; end if;
  if p_attendance_id is not null then
    select * into a from public.attendance where id=p_attendance_id;
    if a.id is null then raise exception 'Attendance not found'; end if;
    if actor.id<>a.staff_id and actor.role::text not in ('owner','god','accountant') then raise exception 'Not allowed'; end if;
  else
    select * into a from public.attendance where staff_id=actor.id and clock_out is null order by clock_in desc limit 1;
    if a.id is null then return 0; end if;
  end if;
  select key::text into branch_key_value from public.branches where id=a.branch_id;
  if branch_key_value<>'garage' or not exists(select 1 from public.staff s where s.id=a.staff_id and s.role::text in ('head_mechanic','mechanic','mechanic_trainee','ceo')) then return 0; end if;
  cutoff_value:=least(coalesce(a.clock_out,clock_timestamp()),clock_timestamp());
  completed_hours:=greatest(0,floor(extract(epoch from(cutoff_value-a.clock_in))/3600)::integer);
  for hour_number in 1..completed_hours loop
    period_start_value:=a.clock_in+make_interval(hours=>hour_number-1);
    period_hour:=extract(hour from(period_start_value at time zone 'Asia/Bangkok'))::integer;
    insert into public.garage_technician_hourly_commissions(attendance_id,staff_id,branch_id,hour_index,period_start,period_end,amount)
    values(a.id,a.staff_id,a.branch_id,hour_number,period_start_value,period_start_value+interval '1 hour',case when period_hour>=18 and period_hour<23 then 15000 else 10000 end)
    on conflict(attendance_id,hour_index) do nothing;
    get diagnostics row_count_value=row_count;
    inserted_count:=inserted_count+row_count_value;
  end loop;
  return inserted_count;
end;
$$;
revoke all on function public.materialize_garage_technician_hours(uuid) from public,anon;
grant execute on function public.materialize_garage_technician_hours(uuid) to authenticated;

-- Reuse the existing 30-second online heartbeat to record completed hours.
create or replace function public.heartbeat_current_staff_attendance()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_staff_id uuid; v_updated integer:=0; v_attendance_id uuid;
begin
  select s.id into v_staff_id from public.staff s where s.auth_user_id=auth.uid() and s.active limit 1;
  if v_staff_id is null then return 0; end if;
  update public.attendance a set last_seen_at=now()
  where a.staff_id=v_staff_id and a.clock_out is null and coalesce(a.last_seen_at,a.clock_in)>=now()-interval '2 hours';
  get diagnostics v_updated=row_count;
  select a.id into v_attendance_id from public.attendance a where a.staff_id=v_staff_id and a.clock_out is null order by a.clock_in desc limit 1;
  if v_attendance_id is not null then perform public.materialize_garage_technician_hours(v_attendance_id); end if;
  return v_updated;
end;
$$;
revoke all on function public.heartbeat_current_staff_attendance() from public,anon;
grant execute on function public.heartbeat_current_staff_attendance() to authenticated;

-- Materialize a final full hour before closing a shift, including immediate
-- clock-outs that happen before the next 30-second heartbeat.
create or replace function public.clock_staff_attendance(p_action text)
returns public.attendance language plpgsql security definer set search_path=public as $$
declare
  actor public.staff%rowtype; attendance_row public.attendance%rowtype;
  branch_key_value text; clock_in_value timestamptz;
begin
  select * into actor from public.staff where auth_user_id=auth.uid() and active=true;
  if not found then raise exception 'Active staff profile required' using errcode='42501'; end if;
  if p_action not in ('clock_in','clock_out') then raise exception 'Invalid attendance action' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text,0));
  select * into attendance_row from public.attendance where staff_id=actor.id and clock_out is null order by clock_in desc limit 1 for update;
  if p_action='clock_in' then
    if found then return attendance_row; end if;
    if actor.primary_branch is null then raise exception 'Primary branch is required' using errcode='22023'; end if;
    select key::text into branch_key_value from public.branches where id=actor.primary_branch;
    clock_in_value:=clock_timestamp();
    insert into public.attendance(staff_id,branch_id,clock_in,garage_commission_period,garage_commission_amount)
    values(actor.id,actor.primary_branch,clock_in_value,
      case when branch_key_value='garage' and actor.role::text in ('head_mechanic','mechanic','mechanic_trainee') then public.garage_commission_period(clock_in_value) end,
      case when branch_key_value='garage' and actor.role::text in ('head_mechanic','mechanic','mechanic_trainee') then case when public.garage_commission_period(clock_in_value)='peak' then 15000 else 10000 end end)
    returning * into attendance_row;
    return attendance_row;
  end if;
  if not found then return null; end if;
  perform public.materialize_garage_technician_hours(attendance_row.id);
  update public.attendance set clock_out=now(),clock_out_source='manual' where id=attendance_row.id returning * into attendance_row;
  return attendance_row;
end;
$$;
revoke all on function public.clock_staff_attendance(text) from public,anon;
grant execute on function public.clock_staff_attendance(text) to authenticated;

-- Restore Garage's per-bill rate (branch commission_flat, normally ¥3,000).
-- The old Garage override charged ¥10k/¥15k per bill and would double-count.
do $$
declare function_sql text;
  old_expected text := $old$
      expected_commission := case
        when bill_input.total > 0 and coalesce(actor.commission_eligible, true) and found
          then case when garage_period_value = 'peak' then 15000 else 10000 end
        else 0
      end;
$old$;
  new_expected text := $new$
      expected_commission := case
        when bill_input.total > 0 and coalesce(actor.commission_eligible, true)
          then coalesce(branch_row.commission_flat, 3000)::integer
        else 0
      end;
$new$;
begin
  select pg_get_functiondef('public.create_bill_with_items_atomic(uuid,jsonb,jsonb,uuid)'::regprocedure) into function_sql;
  if position(old_expected in function_sql)>0 then execute replace(function_sql,old_expected,new_expected);
  elsif position('then case when garage_period_value = ''peak'' then 15000 else 10000 end' in function_sql)>0 then
    raise exception 'Could not safely patch Garage bill commission override';
  end if;
end;
$$;

-- Existing SABINAGISA preview remains as-is; individual branches use their
-- configured per-bill commission, excluding the separate hourly payment.
create or replace function public.preview_my_bill_commission(p_branch_id uuid,p_order_total integer)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  requester public.staff%rowtype; branch_row public.branches%rowtype; attendance_row public.attendance%rowtype; v_mode text;
  v_base integer:=0; v_pool integer:=0; v_count integer:=0; v_index integer;
  v_share integer:=0; v_remainder integer:=0; v_my_amount integer:=0; v_is_peak boolean:=false;
  v_policy text:='branch_individual'; v_garage_period text;
begin
  if p_order_total is null or p_order_total<0 then raise exception 'order_total must be non-negative'; end if;
  select * into requester from public.staff where auth_user_id=auth.uid() and active limit 1;
  if requester.id is null then raise exception 'active staff account not found'; end if;
  select * into branch_row from public.branches where id=p_branch_id;
  if branch_row.id is null then raise exception 'branch not found'; end if;
  if requester.primary_branch is distinct from p_branch_id and requester.role::text not in ('owner','god','ceo','accountant') then raise exception 'staff may only preview commission for their own branch'; end if;
  v_mode:=coalesce(branch_row.commission_mode,'INDIVIDUAL');
  if v_mode='ON_WORK_ALL' then
    v_policy:='sabinagisa_commission_pool'; v_base:=public.commission_pool_base(p_order_total);
    v_is_peak:=public.commission_pool_is_peak(clock_timestamp(),'Asia/Bangkok');
    v_pool:=case when v_is_peak then (v_base*5)/4 else v_base end;
    with eligible as (
      select s.id,(row_number() over(order by s.id)-1)::integer as snapshot_index
      from public.staff s join lateral (select a.id from public.attendance a where a.staff_id=s.id and a.branch_id=p_branch_id and a.clock_in<=clock_timestamp() and a.clock_out is null order by a.clock_in desc,a.id limit 1) attendance_now on true
      where s.active and coalesce(s.commission_eligible,true) and s.primary_branch=p_branch_id
    ) select count(*)::integer,max(snapshot_index) filter(where id=requester.id) into v_count,v_index from eligible;
    if v_count>0 then v_share:=v_pool/v_count; v_remainder:=mod(v_pool,v_count); if v_index is not null then v_my_amount:=v_share+case when v_index<v_remainder then 1 else 0 end; end if; end if;
  else
    v_pool:=case when coalesce(requester.commission_eligible,true) then coalesce(branch_row.commission_flat,0)::integer else 0 end;
    v_count:=case when v_pool>0 then 1 else 0 end; v_my_amount:=case when p_order_total>0 then v_pool else 0 end;
    if branch_row.key::text='garage' and requester.role::text in ('head_mechanic','mechanic','mechanic_trainee') then
      select * into attendance_row from public.attendance a where a.staff_id=requester.id and a.branch_id=branch_row.id
        and a.clock_in<=clock_timestamp() and a.clock_out is null order by a.clock_in desc,a.id limit 1;
      if found then v_garage_period:=coalesce(attendance_row.garage_commission_period,public.garage_commission_period(attendance_row.clock_in)); end if;
    end if;
  end if;
  return jsonb_build_object('mode',v_mode,'policy',v_policy,'orderTotal',p_order_total,'basePool',v_base,'finalPool',v_pool,'activeCount',v_count,'isPeak',v_is_peak,'garagePeriod',v_garage_period,'garageAttendanceId',attendance_row.id,'myAmount',v_my_amount);
end;
$$;
revoke all on function public.preview_my_bill_commission(uuid,integer) from public,anon;
grant execute on function public.preview_my_bill_commission(uuid,integer) to authenticated;

-- Pay hourly commissions through existing payout/cash-ledger history.
create or replace function public.pay_garage_hourly_commission(p_staff_id uuid,p_hourly_commission_ids uuid[],p_reference text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.staff%rowtype; recipient public.staff%rowtype; payout_id_value uuid; amount_value integer; entry_count integer; branch_id_value uuid;
begin
  select * into actor from public.staff where auth_user_id=auth.uid() and active;
  if actor.id is null or actor.role::text not in ('owner','god') then raise exception 'Owner only'; end if;
  if coalesce(array_length(p_hourly_commission_ids,1),0)=0 then raise exception 'No hourly earnings selected'; end if;
  select * into recipient from public.staff where id=p_staff_id;
  if recipient.id is null then raise exception 'Staff not found'; end if;
  perform h.id from public.garage_technician_hourly_commissions h where h.id=any(p_hourly_commission_ids) and h.staff_id=p_staff_id and h.paid_at is null for update;
  select coalesce(sum(h.amount),0),count(*),(array_agg(distinct h.branch_id order by h.branch_id))[1] into amount_value,entry_count,branch_id_value
  from public.garage_technician_hourly_commissions h where h.id=any(p_hourly_commission_ids) and h.staff_id=p_staff_id and h.paid_at is null;
  if entry_count<>array_length(p_hourly_commission_ids,1) or amount_value<=0 or
    (select count(distinct h.branch_id) from public.garage_technician_hourly_commissions h where h.id=any(p_hourly_commission_ids))<>1 then raise exception 'Some hourly earnings were already paid or are invalid'; end if;
  insert into public.commission_payouts(staff_id,branch_id,total_amount,bonus,bill_count,transfer_reference,note,paid_by)
  values(p_staff_id,branch_id_value,amount_value,0,0,nullif(btrim(coalesce(p_reference,'')),''),concat_ws(' · ',nullif(btrim(coalesce(p_note,'')),''),entry_count||' ชั่วโมงค่าคอมช่าง'),actor.id)
  returning id into payout_id_value;
  insert into public.cash_ledger(entry_type,amount,description,commission_payout_id,created_by)
  values('commission_payout',-amount_value,'จ่ายค่าคอมชั่วโมงช่าง '||coalesce(recipient.name_en,'พนักงาน')||' · '||entry_count||' ชั่วโมง',payout_id_value,actor.id);
  update public.garage_technician_hourly_commissions set paid_at=now(),payout_id=payout_id_value where id=any(p_hourly_commission_ids) and staff_id=p_staff_id and paid_at is null;
  return payout_id_value;
end;
$$;
revoke all on function public.pay_garage_hourly_commission(uuid,uuid[],text,text) from public,anon;
grant execute on function public.pay_garage_hourly_commission(uuid,uuid[],text,text) to authenticated;

-- CEOs assigned to the Garage earn the same completed-hour commission as
-- Garage technicians. Backfill their completed hours since 13 Oct 2026.
insert into public.garage_technician_hourly_commissions
  (attendance_id, staff_id, branch_id, hour_index, period_start, period_end, amount)
select
  a.id,
  a.staff_id,
  a.branch_id,
  h.hour_index,
  a.clock_in + make_interval(hours => h.hour_index - 1),
  a.clock_in + make_interval(hours => h.hour_index),
  case
    when extract(hour from ((a.clock_in + make_interval(hours => h.hour_index - 1)) at time zone 'Asia/Bangkok'))::integer between 18 and 22 then 15000
    else 10000
  end
from public.attendance a
join public.staff s on s.id = a.staff_id and s.role::text = 'ceo'
join public.branches b on b.id = a.branch_id and b.key::text = 'garage'
cross join lateral generate_series(
  1,
  greatest(0, floor(extract(epoch from (least(coalesce(a.clock_out, now()), now()) - a.clock_in)) / 3600)::integer)
) as h(hour_index)
where a.clock_in >= timestamptz '2026-10-13 00:00:00+07'
on conflict (attendance_id, hour_index) do nothing;
