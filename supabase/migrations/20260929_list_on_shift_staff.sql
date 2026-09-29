-- Allow staff to see a compact, branch-safe list of the people currently on shift.
create or replace function public.list_on_shift_staff(p_branch_id uuid default null)
returns table(
  id uuid,
  name_en text,
  branch_id uuid,
  branch_name text,
  clock_in timestamptz
)
security definer
set search_path = public, pg_temp
language plpgsql stable as $$
declare
  requester staff;
begin
  select * into requester
  from public.staff
  where auth_user_id = auth.uid() and active
  limit 1;

  if requester.id is null then
    return;
  end if;

  if p_branch_id is null
     and requester.role not in ('owner', 'god', 'accountant') then
    raise exception 'Staff may only view on-shift names for their own branch';
  end if;

  if p_branch_id is not null
     and requester.role not in ('owner', 'god', 'accountant')
     and requester.primary_branch is distinct from p_branch_id then
    raise exception 'Staff may only view on-shift names for their own branch';
  end if;

  return query
  select s.id,
         s.name_en,
         a.branch_id,
         br.name,
         a.clock_in
  from public.attendance a
  join public.staff s on s.id = a.staff_id
  left join public.branches br on br.id = a.branch_id
  where a.clock_out is null
    and s.active = true
    and (p_branch_id is null or a.branch_id = p_branch_id)
    and s.primary_branch = a.branch_id
  order by a.clock_in asc, s.name_en asc;
end;
$$;

revoke all on function public.list_on_shift_staff(uuid) from public;
grant execute on function public.list_on_shift_staff(uuid) to authenticated;
