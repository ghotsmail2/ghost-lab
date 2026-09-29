-- Pay a recipient from the immutable distribution snapshot, rather than
-- inferring eligibility from bills.staff_id.
alter table public.commission_distributions add column if not exists payout_id uuid references public.commission_payouts(id) on delete set null;
create index if not exists commission_distributions_payout_idx on public.commission_distributions(payout_id);

drop function if exists public.pay_staff_commission(uuid, uuid[], text, text, integer);
create or replace function public.pay_staff_commission(
  p_staff_id uuid, p_bill_ids uuid[], p_reference text default null,
  p_note text default null, p_bonus integer default 0
)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.staff%rowtype; new_payout_id uuid; commission_total integer; payout_count integer; payout_branch uuid;
begin
  select * into actor from public.staff where auth_user_id=auth.uid() and active;
  if actor.id is null or actor.role::text not in ('owner','god') then raise exception 'Owner เท่านั้นที่จ่ายค่าคอมได้'; end if;
  if coalesce(p_bonus,0)<0 then raise exception 'โบนัสต้องไม่ติดลบ'; end if;
  if coalesce(array_length(p_bill_ids,1),0)=0 then raise exception 'ไม่มีบิลที่รอจ่าย'; end if;
  perform d.id from public.commission_distributions d where d.bill_id=any(p_bill_ids) and d.user_id=p_staff_id and d.paid_at is null and d.reversed_at is null for update;
  select coalesce(sum(d.amount),0),count(distinct d.bill_id),min(b.branch_id) into commission_total,payout_count,payout_branch
  from public.commission_distributions d join public.bills b on b.id=d.bill_id
  where d.bill_id=any(p_bill_ids) and d.user_id=p_staff_id and d.paid_at is null and d.reversed_at is null and b.status::text not in ('rejected','cancelled');
  if payout_count<>array_length(p_bill_ids,1) or commission_total<=0 then raise exception 'มีบิลที่ถูกจ่ายไปแล้ว หรือไม่มีสิทธิ์รับค่าคอม'; end if;
  if (select count(distinct b.branch_id) from public.bills b where b.id=any(p_bill_ids))<>1 then raise exception 'กรุณาจ่ายแยกตามสาขา'; end if;
  insert into public.commission_payouts(staff_id,branch_id,total_amount,bonus,bill_count,transfer_reference,note,paid_by)
  values(p_staff_id,payout_branch,commission_total+coalesce(p_bonus,0),coalesce(p_bonus,0),payout_count,nullif(btrim(coalesce(p_reference,'')),''),nullif(btrim(coalesce(p_note,'')),''),actor.id)
  returning id into new_payout_id;
  update public.commission_distributions d set paid_at=now(),payout_id=new_payout_id where d.bill_id=any(p_bill_ids) and d.user_id=p_staff_id and d.paid_at is null and d.reversed_at is null;
  return new_payout_id;
end; $$;
revoke all on function public.pay_staff_commission(uuid,uuid[],text,text,integer) from public;
grant execute on function public.pay_staff_commission(uuid,uuid[],text,text,integer) to authenticated;
