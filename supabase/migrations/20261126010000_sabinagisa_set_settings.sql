create or replace function public.save_sabinagisa_menu_settings(
  p_branch_id uuid,
  p_layout jsonb,
  p_expected_layout jsonb,
  p_material_changes jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  change_row record;
  current_formula jsonb;
  new_formula jsonb;
begin
  -- Reuse the existing permission, branch, catalog and stale-layout checks.
  perform public.save_sabinagisa_menu_layout(p_branch_id, p_layout, p_expected_layout);

  if jsonb_typeof(p_material_changes) is distinct from 'array' then
    raise exception 'ข้อมูลวัตถุดิบต้องเป็นรายการ' using errcode = '22023';
  end if;
  if jsonb_array_length(p_material_changes) = 0 then return; end if;

  -- Serialize formula writes with the existing per-service Materials editor.
  -- Sales can continue to read committed formulas while the catalog is edited.
  lock table public.service_materials in share row exclusive mode;

  for change_row in
    select * from jsonb_to_recordset(p_material_changes)
      as entry("serviceId" uuid, materials jsonb, "expectedMaterials" jsonb)
  loop
    if change_row."serviceId" is null or not exists (
      select 1 from jsonb_array_elements(p_layout) as entry(value)
      where entry.value->>'setId' = change_row."serviceId"::text
    ) or jsonb_typeof(change_row.materials) is distinct from 'array'
      or jsonb_typeof(change_row."expectedMaterials") is distinct from 'object' then
      raise exception 'ข้อมูลวัตถุดิบของเซ็ตไม่ถูกต้อง' using errcode = '22023';
    end if;

    if exists (
      select 1 from jsonb_to_recordset(change_row.materials) as material(stock_item_id uuid, qty_per_unit integer)
      left join public.stock_items stock on stock.id = material.stock_item_id and stock.branch_id = p_branch_id
      where stock.id is null or material.qty_per_unit is null or material.qty_per_unit <= 0
    ) then
      raise exception 'เลือกวัตถุดิบในสาขาและใส่จำนวนที่มากกว่า 0' using errcode = '22023';
    end if;

    select coalesce(jsonb_object_agg(stock_item_id::text, qty_per_unit), '{}'::jsonb) into current_formula
    from public.service_materials where service_id = change_row."serviceId";

    select coalesce(jsonb_object_agg(stock_item_id::text, qty_per_unit), '{}'::jsonb) into new_formula
    from jsonb_to_recordset(change_row.materials) as material(stock_item_id uuid, qty_per_unit integer);

    if current_formula = new_formula then continue; end if;
    if current_formula <> change_row."expectedMaterials" then
      raise exception 'สูตรวัตถุดิบถูกแก้ไขแล้ว' using errcode = '40001';
    end if;

    delete from public.service_materials where service_id = change_row."serviceId";
    insert into public.service_materials (service_id, stock_item_id, qty_per_unit)
    select change_row."serviceId", material.stock_item_id, material.qty_per_unit
    from jsonb_to_recordset(change_row.materials) as material(stock_item_id uuid, qty_per_unit integer);
  end loop;
end;
$$;

revoke all on function public.save_sabinagisa_menu_settings(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_sabinagisa_menu_settings(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Carry forward the original Yoru grouping as editable catalog configuration.
-- Existing item order and saved Materials remain authoritative.
do $$
declare
  restaurant record;
  no_alcohol_id text;
  alcohol_id text;
  variant_id text;
  variant_label text;
  default_items jsonb;
  next_layout jsonb;
begin
  for restaurant in select id, menu_layout from public.branches where key::text = 'chill' loop
    select min(id::text) into no_alcohol_id from public.services
    where branch_id = restaurant.id and active and lower(btrim(category)) = 'set'
      and upper(btrim(name)) ~ '^SABI YORU SET[[:space:]]*\(NO ALCOH[OA]L\)$'
    having count(*) = 1;

    select min(id::text) into alcohol_id from public.services
    where branch_id = restaurant.id and active and lower(btrim(category)) = 'set'
      and upper(btrim(name)) ~ '^SABI YORU SET[[:space:]]*\(ALCOH[OA]L\)$'
    having count(*) = 1;

    if no_alcohol_id is null or alcohol_id is null then continue; end if;
    next_layout := restaurant.menu_layout;
    foreach variant_id in array array[no_alcohol_id, alcohol_id] loop
      variant_label := case when variant_id = no_alcohol_id then 'ไม่มีแอลกอฮอล์' else 'มีแอลกอฮอล์' end;
      if exists (select 1 from jsonb_array_elements(next_layout) as entry(value) where value->>'setId' = variant_id) then
        select jsonb_agg(case
          when entry.value->>'setId' = variant_id and not (entry.value ? 'variantGroup') then
            entry.value || jsonb_build_object('variantGroup', 'SABI YORU SET', 'variantLabel', variant_label)
          else entry.value end order by entry.ordinal) into next_layout
        from jsonb_array_elements(next_layout) with ordinality as entry(value, ordinal);
      else
        select coalesce(jsonb_agg(matched.id order by item.ordinal), '[]'::jsonb) into default_items
        from unnest(array['SABI UNAGI', 'SABI NAGI HIGHBALL',
          case when variant_id = no_alcohol_id then 'SABI AOBA' else 'SABI YORU UME' end])
          with ordinality as item(name, ordinal)
        cross join lateral (
          select min(service.id::text) as id from public.services service
          where service.branch_id = restaurant.id and service.active and lower(btrim(service.category)) <> 'set'
            and upper(btrim(service.name)) = item.name
          having count(*) = 1
        ) as matched;
        next_layout := next_layout || jsonb_build_array(jsonb_build_object('setId', variant_id, 'itemIds', default_items,
          'variantGroup', 'SABI YORU SET', 'variantLabel', variant_label));
      end if;
    end loop;
    update public.branches set menu_layout = next_layout where id = restaurant.id;
  end loop;
end;
$$;
