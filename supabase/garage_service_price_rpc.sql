-- Securely save Garage catalog prices without depending on direct table UPDATE
-- grants/RLS. Only Owner/GOD or the CEO assigned to the Garage branch may write.
-- This function only accepts Ghost Lab Garage services; it never touches SABINAGISA.

create or replace function public.update_garage_service_price(
  p_service_id uuid,
  p_vehicle_class text,
  p_price integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_service public.services%rowtype;
  actor public.staff%rowtype;
begin
  select service.*
    into target_service
  from public.services as service
  join public.branches as branch on branch.id = service.branch_id
  where service.id = p_service_id
    and branch.key::text = 'garage'
  for update of service;

  if not found then
    raise exception 'ไม่พบบริการของ Ghost Lab Garage' using errcode = 'P0002';
  end if;

  select staff.*
    into actor
  from public.staff as staff
  where staff.auth_user_id = auth.uid()
    and staff.active = true
  limit 1;

  if not found then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์แก้ราคา' using errcode = '42501';
  end if;

  if actor.role::text not in ('owner', 'god')
     and not (actor.role::text = 'ceo' and actor.primary_branch = target_service.branch_id) then
    raise exception 'ต้องเป็น Owner/GOD หรือ CEO ของสาขา Garage' using errcode = '42501';
  end if;

  if p_vehicle_class = 'standard' then
    if p_price is null or p_price < 0 then
      raise exception 'ราคา Standard ต้องเป็น 0 หรือมากกว่า' using errcode = '22023';
    end if;
    update public.services
      set price = p_price
      where id = p_service_id
      returning * into target_service;
  elsif p_vehicle_class = 'supercar' then
    if p_price is not null and p_price <= 0 then
      raise exception 'ราคา Super Car ต้องมากกว่า 0 หรือเว้นว่าง' using errcode = '22023';
    end if;
    update public.services
      set supercar_price = p_price
      where id = p_service_id
      returning * into target_service;
  else
    raise exception 'ประเภทราคารถไม่ถูกต้อง' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'id', target_service.id,
    'price', target_service.price,
    'supercar_price', target_service.supercar_price
  );
end;
$$;

revoke all on function public.update_garage_service_price(uuid, text, integer) from public, anon;
grant execute on function public.update_garage_service_price(uuid, text, integer) to authenticated;
