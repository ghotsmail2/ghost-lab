-- Preview the signed-in staff member's commission before a bill is saved.
-- The pool calculation intentionally mirrors calculate_bill_commission_pool;
-- the saved bill snapshot remains the final source of truth.
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
  v_mode text;
  v_base integer := 0;
  v_pool integer := 0;
  v_count integer := 0;
  v_index integer;
  v_share integer := 0;
  v_remainder integer := 0;
  v_my_amount integer := 0;
  v_is_peak boolean := false;
begin
  if p_order_total is null or p_order_total < 0 then
    raise exception 'order_total must be non-negative';
  end if;

  select * into requester
  from public.staff
  where auth_user_id = auth.uid() and active
  limit 1;

  if requester.id is null then
    raise exception 'active staff account not found';
  end if;

  select * into branch_row
  from public.branches
  where id = p_branch_id;

  if branch_row.id is null then
    raise exception 'branch not found';
  end if;

  if requester.primary_branch is distinct from p_branch_id
     and requester.role::text not in ('owner','god','ceo','accountant') then
    raise exception 'staff may only preview commission for their own branch';
  end if;

  v_mode := coalesce(branch_row.commission_mode, 'INDIVIDUAL');

  if v_mode = 'ON_WORK_ALL' then
    v_base := public.commission_pool_base(p_order_total);
    v_is_peak := public.commission_pool_is_peak(clock_timestamp(), 'Asia/Bangkok');
    v_pool := case when v_is_peak then (v_base * 5) / 4 else v_base end;

    with eligible as (
      select s.id,
             (row_number() over(order by s.id) - 1)::integer as snapshot_index
      from public.staff s
      join lateral (
        select a.id
        from public.attendance a
        where a.staff_id = s.id
          and a.branch_id = p_branch_id
          and a.clock_in <= clock_timestamp()
          and a.clock_out is null
        order by a.clock_in desc, a.id
        limit 1
      ) attendance_now on true
      where s.active
        and coalesce(s.commission_eligible, true)
        and s.primary_branch = p_branch_id
    )
    select count(*)::integer,
           max(snapshot_index) filter (where id = requester.id)
      into v_count, v_index
    from eligible;

    if v_count > 0 then
      v_share := v_pool / v_count;
      v_remainder := mod(v_pool, v_count);
      if v_index is not null then
        v_my_amount := v_share + case when v_index < v_remainder then 1 else 0 end;
      end if;
    end if;
  else
    v_pool := case
      when coalesce(requester.commission_eligible, true)
      then coalesce(branch_row.commission_flat, 0)::integer
      else 0
    end;
    v_count := case when v_pool > 0 then 1 else 0 end;
    v_my_amount := v_pool;
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'orderTotal', p_order_total,
    'basePool', v_base,
    'finalPool', v_pool,
    'activeCount', v_count,
    'isPeak', v_is_peak,
    'myAmount', v_my_amount
  );
end;
$$;

revoke all on function public.preview_my_bill_commission(uuid,integer) from public;
grant execute on function public.preview_my_bill_commission(uuid,integer) to authenticated;
