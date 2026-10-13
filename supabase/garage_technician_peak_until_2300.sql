-- Apply the updated Garage-only technician commission window.
-- Peak is Bangkok local time [18:00, 23:00); all other hours are Normal.
-- SABINAGISA commission-pool policy is intentionally untouched.

create or replace function public.garage_commission_period(p_clock_in timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when extract(hour from (p_clock_in at time zone 'Asia/Bangkok')) >= 18
      and extract(hour from (p_clock_in at time zone 'Asia/Bangkok')) < 23 then 'peak'
    else 'normal'
  end;
$$;

revoke all on function public.garage_commission_period(timestamptz) from public, anon;
grant execute on function public.garage_commission_period(timestamptz) to authenticated;
