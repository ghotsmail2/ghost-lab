-- Read the Stock workspace through one narrowly scoped SECURITY DEFINER RPC.
-- This avoids fragile PostgREST/RLS joins without broadening table access.
create or replace function public.get_stock_workspace_for_current_staff()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor public.staff%rowtype;
  result jsonb;
begin
  select * into actor from public.staff where auth_user_id = auth.uid() and active = true;
  if not found then
    raise exception 'Active staff profile required' using errcode = '42501';
  end if;
  if actor.role::text not in ('owner', 'god', 'stock_keeper', 'ceo')
     and not public.has_granted_permission('stock_access') then
    raise exception 'Stock access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'key', b.key, 'name', b.name) order by b.name)
      from public.branches b where public.can_access_stock_branch(b.id)
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) || jsonb_build_object('branches', jsonb_build_object('key', b.key, 'name', b.name)) order by i.category, i.name)
      from public.stock_items i join public.branches b on b.id = i.branch_id
      where public.can_access_stock_branch(i.branch_id)
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'stock_item_id', m.stock_item_id, 'staff_id', m.staff_id,
        'change', m.change, 'reason', m.reason, 'created_at', m.created_at,
        'staff', jsonb_build_object('name_en', s.name_en)
      ) order by m.created_at desc)
      from (
        select sm.* from public.stock_movements sm
        join public.stock_items i on i.id = sm.stock_item_id
        where public.can_access_stock_branch(i.branch_id)
        order by sm.created_at desc limit 30
      ) m
      left join public.staff s on s.id = m.staff_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_stock_workspace_for_current_staff() from public, anon;
grant execute on function public.get_stock_workspace_for_current_staff() to authenticated;
