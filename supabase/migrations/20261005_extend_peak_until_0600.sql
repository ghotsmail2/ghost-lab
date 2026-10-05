-- Peak begins at 18:00 and spans midnight through 05:59 Bangkok time.
-- The first order timestamp remains the authoritative time for a bill.
create or replace function public.commission_pool_is_peak(
  p_first_order_time timestamptz,
  p_timezone text default 'Asia/Bangkok'
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  local_time time;
begin
  if p_first_order_time is null then
    return false;
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone: %', coalesce(p_timezone, '<null>');
  end if;

  local_time := (p_first_order_time at time zone p_timezone)::time;
  return local_time >= time '18:00:00' or local_time < time '06:00:00';
end;
$$;

comment on function public.commission_pool_is_peak(timestamptz, text)
  is 'Peak is 18:00 through 05:59:59 in the configured local timezone.';
