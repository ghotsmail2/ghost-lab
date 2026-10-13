-- Prevent open attendance rows from surviving a forgotten logout forever.
-- Explicit logout closes the current user's open rows immediately. If the
-- browser is closed first, stale rows are closed on the next sign-in.

alter table public.attendance
  add column if not exists clock_out_source text;

alter table public.attendance
  add column if not exists last_seen_at timestamptz;

update public.attendance
   set last_seen_at = clock_in
 where last_seen_at is null;

alter table public.attendance
  alter column last_seen_at set default now();

create index if not exists attendance_open_last_seen_idx
  on public.attendance (last_seen_at)
  where clock_out is null;

update public.attendance
set clock_out_source = 'manual'
where clock_out_source is null;

alter table public.attendance
  alter column clock_out_source set default 'manual',
  alter column clock_out_source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.attendance'::regclass
      and conname = 'attendance_clock_out_source_check'
  ) then
    alter table public.attendance
      add constraint attendance_clock_out_source_check
      check (clock_out_source in ('manual', 'logout', 'stale_timeout'));
  end if;
end
$$;

create or replace function public.heartbeat_current_staff_attendance()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_updated integer := 0;
begin
  select s.id into v_staff_id
    from public.staff s
   where s.auth_user_id = auth.uid() and s.active = true
   limit 1;
  if v_staff_id is null then return 0; end if;

  update public.attendance a
     set last_seen_at = now()
   where a.staff_id = v_staff_id
     and a.clock_out is null
     and coalesce(a.last_seen_at, a.clock_in) >= now() - interval '2 hours';
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.heartbeat_current_staff_attendance() from public;
grant execute on function public.heartbeat_current_staff_attendance() to authenticated;

-- Optional seconds argument supports a controlled 60-second verification;
-- scheduled/default production timeout is two hours.
create or replace function public.auto_close_inactive_attendance(
  p_stale_after_seconds integer default 7200,
  p_test_staff_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_timeout_seconds integer := greatest(coalesce(p_stale_after_seconds, 7200), 60);
  v_closed integer := 0;
begin
  update public.attendance a
     set clock_out = coalesce(a.last_seen_at, a.clock_in),
         clock_out_source = 'stale_timeout'
   where a.clock_out is null
     and coalesce(a.last_seen_at, a.clock_in) < now() - make_interval(secs => v_timeout_seconds)
     and (v_timeout_seconds >= 7200 or (p_test_staff_id is not null and a.staff_id = p_test_staff_id));
  get diagnostics v_closed = row_count;
  return v_closed;
end;
$$;

revoke all on function public.auto_close_inactive_attendance(integer, uuid) from public;
grant execute on function public.auto_close_inactive_attendance(integer, uuid) to service_role;

create or replace function public.auto_clock_out_current_staff(
  p_source text default 'logout',
  p_max_age_hours integer default 2
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_source text;
  v_max_age_hours integer := greatest(coalesce(p_max_age_hours, 2), 1);
  v_closed_count integer := 0;
begin
  v_source := case
    when p_source = 'stale_timeout' then 'stale_timeout'
    else 'logout'
  end;

  select s.id
    into v_staff_id
    from public.staff s
   where s.auth_user_id = auth.uid()
     and s.active = true
   limit 1;

  if v_staff_id is null then
    return 0;
  end if;

  update public.attendance a
     set clock_out = case
       when v_source = 'stale_timeout'
         then coalesce(a.last_seen_at, a.clock_in)
       else now()
     end,
         clock_out_source = v_source
   where a.staff_id = v_staff_id
     and a.clock_out is null
     and (
       v_source = 'logout'
       or coalesce(a.last_seen_at, a.clock_in) < now() - make_interval(hours => v_max_age_hours)
     );

  get diagnostics v_closed_count = row_count;
  return v_closed_count;
end;
$$;

revoke all on function public.auto_clock_out_current_staff(text, integer) from public;
grant execute on function public.auto_clock_out_current_staff(text, integer) to authenticated;

-- A scheduled sweep covers the case where a browser is closed and the staff
-- member does not return to the app for a while. It is intentionally
-- conservative: only shifts older than the configured maximum are closed.
create or replace function public.auto_close_stale_attendance(
  p_max_age_hours integer default 16
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_age_hours integer := greatest(coalesce(p_max_age_hours, 16), 1);
  v_closed_count integer := 0;
begin
  update public.attendance a
     set clock_out = least(now(), a.clock_in + make_interval(hours => v_max_age_hours)),
         clock_out_source = 'stale_timeout'
   where a.clock_out is null
     and a.clock_in < now() - make_interval(hours => v_max_age_hours);

  get diagnostics v_closed_count = row_count;
  return v_closed_count;
end;
$$;

revoke all on function public.auto_close_stale_attendance(integer) from public;
grant execute on function public.auto_close_stale_attendance(integer) to service_role;

create or replace function public.count_on_shift_staff(p_branch_id uuid)
returns integer
security definer
set search_path = public, pg_temp
language plpgsql stable as $$
declare
  requester public.staff;
  result_count integer;
begin
  select * into requester from public.staff where auth_user_id = auth.uid() and active limit 1;
  if requester.id is null or p_branch_id is null then return 0; end if;
  if requester.role not in ('owner', 'god', 'accountant')
     and requester.primary_branch is distinct from p_branch_id then
    raise exception 'Staff may only view the on-shift count for their own branch';
  end if;

  select count(distinct a.staff_id)::integer into result_count
  from public.attendance a
  join public.staff s on s.id = a.staff_id
  where a.branch_id = p_branch_id
    and a.clock_out is null
    and s.active = true
    and s.primary_branch = p_branch_id;
  return coalesce(result_count, 0);
end;
$$;

revoke all on function public.count_on_shift_staff(uuid) from public;
grant execute on function public.count_on_shift_staff(uuid) to authenticated;

-- Sweep abandoned sessions each minute. Production inactivity limit is two
-- hours; auto_close_inactive_attendance also accepts 60 seconds for testing.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    if exists (select 1 from cron.job where jobname = 'ghostlab-auto-close-inactive-attendance') then
      perform cron.unschedule('ghostlab-auto-close-inactive-attendance');
    end if;
    perform cron.schedule(
      'ghostlab-auto-close-inactive-attendance',
      '* * * * *',
      'select public.auto_close_inactive_attendance();'
    );
  end if;
end
$$;

-- Supabase projects with pg_cron installed get a server-side sweep every 15
-- minutes. On projects without it, login-time cleanup above remains active.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
     and not exists (select 1 from cron.job where jobname = 'ghostlab-auto-close-attendance') then
    perform cron.schedule(
      'ghostlab-auto-close-attendance',
      '*/15 * * * *',
      'select public.auto_close_stale_attendance(16);'
    );
  end if;
end
$$;

