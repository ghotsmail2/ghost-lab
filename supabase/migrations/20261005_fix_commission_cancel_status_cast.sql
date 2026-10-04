-- Keep bill cancellation compatible with the bill_status enum after the
-- commission pool trigger was introduced.  Both sides of the comparison must
-- use the same type; comparing text to bill_status aborts cancel_bill_safely.
create or replace function public.reverse_bill_commission_distributions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status::text in ('rejected','cancelled')
     and old.status::text is distinct from new.status::text then
    update public.commission_distributions
    set reversed_at=coalesce(reversed_at,clock_timestamp())
    where bill_id=new.id and reversed_at is null and paid_at is null;

    update public.bills
    set commission_calculation_status='reversed'
    where id=new.id and commission_calculation_version='pool-v1';
  end if;
  return new;
end;
$$;
