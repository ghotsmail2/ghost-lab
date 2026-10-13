-- Let the Garage service manager enter an explicit Super Car price per service.
-- Seed the requested gearbox and angle kit tariffs once; future edits are made
-- from Services Catalog and persisted on the service itself.
alter table public.services
  add column if not exists supercar_price integer
  check (supercar_price is null or supercar_price > 0);

update public.services s
set supercar_price = case lower(trim(s.name))
  when 'gearbox' then 2000000
  when 'angle kit' then 75000
  else s.supercar_price
end
from public.branches b
where s.branch_id = b.id
  and b.key::text = 'garage'
  and lower(trim(s.name)) in ('gearbox', 'angle kit')
  and s.supercar_price is null;

-- Keep server-side checkout validation authoritative. Require the atomic POS
-- validator migration to have been applied before installing this adjustment.
do $$
declare
  function_sql text;
  old_branch text := '    if catalog_entry is not null and catalog_entry ->> ''status'' = ''priced'' then';
  new_branch text := '    if vehicle_class = ''supercar'' and service_row.supercar_price is not null then
      expected_price := service_row.supercar_price;
    elsif catalog_entry is not null and catalog_entry ->> ''status'' = ''priced'' then';
begin
  select pg_get_functiondef('public.validate_atomic_pos_item_price()'::regprocedure)
    into function_sql;
  if function_sql is null then
    raise exception 'Atomic POS price validator is missing; apply 20261013101000_atomic_pos_checkout.sql first';
  end if;
  if position('service_row.supercar_price' in function_sql) > 0 then
    return;
  end if;
  if position(old_branch in function_sql) = 0 then
    raise exception 'Could not safely patch the atomic POS price validator';
  end if;
  function_sql := replace(function_sql, old_branch, new_branch);
  execute function_sql;
end $$;
