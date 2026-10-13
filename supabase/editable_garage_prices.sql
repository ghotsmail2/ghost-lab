-- Garage prices come from editable service rows, not fixed catalog values.
alter table public.services add column if not exists supercar_price integer
  check (supercar_price is null or supercar_price > 0);

-- Backfill current Super Car rates once. Existing custom values are preserved.
update public.services s
set supercar_price = coalesce(
  case lower(trim(s.name))
    when 'เหมา n/a (standard)' then 840000
    when 'เหมา turbo set !!' then 1045000
    when 'เหมา handing' then 600000
    else null
  end,
  (
    select (entry.value ->> 'supercar')::integer
    from public.pos_pricing_catalog c
    cross join lateral jsonb_array_elements(c.prices) as entry(value)
    where c.singleton = true and entry.value ->> 'status' = 'priced'
      and exists (
        select 1 from jsonb_array_elements_text(entry.value -> 'names') as n(value)
        where lower(regexp_replace(regexp_replace(trim(n.value), '^sport\s*:\s*', '', 'i'), '\s+', ' ', 'g'))
          = lower(regexp_replace(regexp_replace(trim(s.name), '^sport\s*:\s*', '', 'i'), '\s+', ' ', 'g'))
      )
    limit 1
  )
)
from public.branches b
where s.branch_id = b.id and b.key::text = 'garage' and s.supercar_price is null;

-- Replace only the price calculation in the current atomic validator.
do $$
declare
  function_sql text;
  old_catalog_block text := $old$
    if catalog_entry is not null and catalog_entry ->> 'status' = 'priced' then
      expected_price := (catalog_entry ->> vehicle_class)::integer;
    elsif vehicle_class = 'supercar' and not is_repair_kit then
      if catalog_entry ->> 'status' = 'not_for_sale' then
        raise exception 'This item is not available for sale' using errcode = '22023';
      end if;
      raise exception 'No verified Super Car price exists for this item' using errcode = '22023';
    end if;
$old$;
  old_supercar_block text := $old$
    if vehicle_class = 'supercar' and service_row.supercar_price is not null then
      expected_price := service_row.supercar_price;
    elsif catalog_entry is not null and catalog_entry ->> 'status' = 'priced' then
      expected_price := (catalog_entry ->> vehicle_class)::integer;
    elsif vehicle_class = 'supercar' and not is_repair_kit then
      if catalog_entry ->> 'status' = 'not_for_sale' then
        raise exception 'This item is not available for sale' using errcode = '22023';
      end if;
      raise exception 'No verified Super Car price exists for this item' using errcode = '22023';
    end if;
$old$;
  editable_block text := $new$
    -- editable_garage_service_prices: service rows are the source of truth.
    if vehicle_class = 'standard' then
      expected_price := service_row.price;
    elsif vehicle_class = 'supercar' and service_row.supercar_price is not null then
      expected_price := service_row.supercar_price;
    elsif vehicle_class = 'supercar' and is_repair_kit then
      expected_price := service_row.price;
    elsif vehicle_class = 'supercar' and not is_repair_kit then
      if catalog_entry ->> 'status' = 'not_for_sale' then
        raise exception 'This item is not available for sale' using errcode = '22023';
      end if;
      raise exception 'No Super Car price is configured for this service' using errcode = '22023';
    end if;
$new$;
begin
  select pg_get_functiondef('public.validate_atomic_pos_item_price()'::regprocedure)
    into function_sql;
  if function_sql is null then raise exception 'Atomic POS item validator is missing'; end if;
  if position('editable_garage_service_prices' in function_sql) > 0 then return; end if;
  if position(old_supercar_block in function_sql) > 0 then
    function_sql := replace(function_sql, old_supercar_block, editable_block);
  elsif position(old_catalog_block in function_sql) > 0 then
    function_sql := replace(function_sql, old_catalog_block, editable_block);
  else
    raise exception 'Could not safely patch the atomic POS price validator';
  end if;
  execute function_sql;
end $$;
