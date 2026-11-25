alter table public.branches
  add column if not exists menu_layout jsonb not null default '[]'::jsonb;

create or replace function public.save_sabinagisa_menu_layout(
  p_branch_id uuid,
  p_layout jsonb,
  p_expected_layout jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_layout jsonb;
  menu_group jsonb;
  set_id text;
  item_id text;
  set_ids text[] := '{}';
  item_ids text[];
begin
  if not exists (
    select 1 from public.staff actor
    where actor.auth_user_id = auth.uid()
      and actor.active
      and (
        actor.role::text in ('owner', 'god')
        or (actor.role::text = 'ceo' and actor.primary_branch = p_branch_id)
      )
  ) then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์จัดลำดับเมนู' using errcode = '42501';
  end if;

  select branch.menu_layout into current_layout
  from public.branches branch
  where branch.id = p_branch_id and branch.key::text = 'chill'
  for update;
  if not found then
    raise exception 'ไม่พบสาขา SABINAGISA' using errcode = 'P0002';
  end if;
  if current_layout is distinct from p_expected_layout and current_layout is distinct from p_layout then
    raise exception 'ลำดับเมนูถูกแก้ไขแล้ว' using errcode = '40001';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'array' then
    raise exception 'ข้อมูลลำดับเมนูต้องเป็นรายการ' using errcode = '22023';
  end if;

  for menu_group in select value from jsonb_array_elements(p_layout) loop
    set_id := menu_group->>'setId';
    if set_id is null or set_id = any(set_ids)
      or jsonb_typeof(menu_group->'itemIds') is distinct from 'array'
      or not exists (
        select 1 from public.services service
        where service.id::text = set_id and service.branch_id = p_branch_id
          and service.active and lower(btrim(service.category)) = 'set'
      ) then
      raise exception 'เซตซ้ำหรือไม่อยู่ในเมนูที่เปิดขาย' using errcode = '22023';
    end if;
    set_ids := array_append(set_ids, set_id);
    item_ids := '{}';
    for item_id in select value from jsonb_array_elements_text(menu_group->'itemIds') loop
      if item_id is null or item_id = any(item_ids)
        or not exists (
          select 1 from public.services service
          where service.id::text = item_id and service.branch_id = p_branch_id
            and service.active and lower(btrim(service.category)) <> 'set'
        ) then
        raise exception 'เมนูในเซตซ้ำหรือไม่อยู่ในเมนูที่เปิดขาย' using errcode = '22023';
      end if;
      item_ids := array_append(item_ids, item_id);
    end loop;
  end loop;

  update public.branches set menu_layout = p_layout where id = p_branch_id;
end;
$$;

revoke all on function public.save_sabinagisa_menu_layout(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_sabinagisa_menu_layout(uuid, jsonb, jsonb) to authenticated;
