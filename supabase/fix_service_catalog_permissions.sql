-- Restore service-catalog writes without exposing private staff columns.
-- The previous services_write policy queried staff.auth_user_id directly,
-- but that column is intentionally not granted to authenticated users.

create or replace function public.can_manage_service_catalog(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff actor
    where actor.auth_user_id = auth.uid()
      and actor.active = true
      and (
        public.is_god()
        or actor.role::text = 'owner'
        or (actor.role::text = 'ceo' and actor.primary_branch = p_branch_id)
      )
  );
$$;

revoke all on function public.can_manage_service_catalog(uuid) from public, anon;
grant execute on function public.can_manage_service_catalog(uuid) to authenticated;

-- Table privileges are required in addition to the row-level policy below.
-- RLS still limits all writes to Owner/GOD or the CEO's assigned branch.
revoke all on public.services from public, anon;
grant select, insert, update, delete on public.services to authenticated;

drop policy if exists services_write on public.services;
drop policy if exists services_write_owner on public.services;
drop policy if exists services_write_owner_ceo_branch on public.services;

create policy services_write_owner_ceo_branch
on public.services
for all
to authenticated
using (public.can_manage_service_catalog(branch_id))
with check (public.can_manage_service_catalog(branch_id));
