-- Garage POS hotfix: server owns the individual bill rate for mechanics.
-- Older clients / stale previews may submit a different commission amount;
-- normalize that value before insert instead of stranding a valid bill in the
-- checkout-recovery UI. SABINAGISA and other branches retain strict validation.
do $$
declare
  function_sql text;
  patched_sql text;
begin
  select pg_get_functiondef(
    'public.create_bill_with_items_atomic(uuid,jsonb,jsonb,uuid)'::regprocedure
  ) into function_sql;

  if function_sql is null then
    raise exception 'create_bill_with_items_atomic was not found';
  end if;

  -- Whether the currently installed function has the old hourly-per-bill
  -- override or the newer flat-rate logic, Garage mechanics earn the active
  -- branch bill rate. Their hourly attendance pay remains a separate payout.
  patched_sql := regexp_replace(
    function_sql,
    $pattern$expected_commission := case\s+when bill_input\.total > 0 and coalesce\(actor\.commission_eligible, true\)(?: and found)?\s+then (?:case when garage_period_value = 'peak' then 15000 else 10000 end|coalesce\(branch_row\.commission_flat, (?:0|3000)\)::integer)\s+else 0\s+end;$pattern$,
    $replacement$expected_commission := case
      when bill_input.total > 0 and (
        (branch_row.key::text = 'garage' and actor.role::text in ('head_mechanic','mechanic','mechanic_trainee'))
        or coalesce(actor.commission_eligible, true)
      ) then coalesce(branch_row.commission_flat, 3000)::integer
      else 0
    end;$replacement$,
    'g'
  );

  if patched_sql !~ $required$expected_commission := case\s+when bill_input\.total > 0 and \(\s*\(branch_row\.key::text = 'garage' and actor\.role::text in \('head_mechanic','mechanic','mechanic_trainee'\)\)$required$ then
    raise exception 'Could not normalize Garage bill commission to the branch rate; no changes applied';
  end if;

  -- Replace only the client/server mismatch rejection with a server-side
  -- normalization for Garage technicians. Keep the rejection for all others.
  patched_sql := replace(
    patched_sql,
    $old$    if bill_input.commission is distinct from expected_commission then
      raise exception 'Individual commission differs from the active branch rate' using errcode = '22023';
    end if;$old$,
    $new$    if branch_row.key::text = 'garage' and actor.role::text in ('head_mechanic','mechanic','mechanic_trainee') then
      bill_input.commission := expected_commission;
    end if;
    if bill_input.commission is distinct from expected_commission then
      raise exception 'Individual commission differs from the active branch rate' using errcode = '22023';
    end if;$new$
  );

  if patched_sql = function_sql
     or position('bill_input.commission := expected_commission;' in patched_sql) = 0 then
    raise exception 'Could not safely patch Garage commission validation; no changes applied';
  end if;

  execute patched_sql;
end;
$$;
