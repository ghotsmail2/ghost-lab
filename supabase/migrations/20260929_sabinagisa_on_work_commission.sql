-- Per-recipient commission distributions. Sabinagisa (the chill branch) uses
-- ON_WORK_ALL; other branches remain creator-based INDIVIDUAL.
alter table public.branches add column if not exists commission_mode text not null default 'INDIVIDUAL';
alter table public.branches drop constraint if exists branches_commission_mode_check;
alter table public.branches add constraint branches_commission_mode_check check (commission_mode in ('INDIVIDUAL','ON_WORK_ALL','NONE'));
update public.branches set commission_mode = 'ON_WORK_ALL' where key::text = 'chill';
alter table public.staff add column if not exists commission_eligible boolean not null default true;
alter table public.bills add column if not exists commission_mode text not null default 'INDIVIDUAL', add column if not exists completed_at timestamptz;
alter table public.bills drop constraint if exists bills_commission_mode_check;
alter table public.bills add constraint bills_commission_mode_check check (commission_mode in ('INDIVIDUAL','ON_WORK_ALL','NONE'));

create table if not exists public.commission_distributions (
  id uuid primary key default gen_random_uuid(), bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid references public.staff(id) on delete set null, user_name_snapshot text not null,
  amount integer not null check (amount >= 0), commission_mode text not null check (commission_mode in ('INDIVIDUAL','ON_WORK_ALL')),
  created_at timestamptz not null default now(), paid_at timestamptz, pay_period_id uuid references public.pay_periods(id) on delete set null,
  reversed_at timestamptz, unique (bill_id,user_id)
);
create index if not exists commission_distributions_user_unpaid_idx on public.commission_distributions(user_id,created_at) where paid_at is null and reversed_at is null;
create index if not exists commission_distributions_bill_idx on public.commission_distributions(bill_id);
alter table public.commission_distributions enable row level security;
drop policy if exists commission_distributions_read on public.commission_distributions;
create policy commission_distributions_read on public.commission_distributions for select to authenticated using (
  user_id=(select id from public.staff where auth_user_id=auth.uid())
  or exists(select 1 from public.staff where auth_user_id=auth.uid() and role::text in ('owner','god','accountant'))
  or exists(select 1 from public.bills b join public.staff actor on actor.auth_user_id=auth.uid() where b.id=commission_distributions.bill_id and actor.primary_branch=b.branch_id and actor.role::text in ('ceo','head_mechanic','chill_manager'))
);

create or replace function public.materialize_bill_commission(p_bill_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare b public.bills%rowtype; completed_at_value timestamptz; recipient_count integer:=0;
begin
  select * into b from public.bills where id=p_bill_id for update;
  if b.id is null or b.commission<=0 or b.status::text in ('rejected','cancelled') then return 0; end if;
  completed_at_value:=coalesce(b.completed_at,b.created_at,now());
  if b.completed_at is null then update public.bills set completed_at=completed_at_value where id=b.id; end if;
  if b.commission_mode='INDIVIDUAL' then
    select coalesce(br.commission_mode,'INDIVIDUAL') into b.commission_mode from public.branches br where br.id=b.branch_id;
    update public.bills set commission_mode=b.commission_mode where id=b.id;
  end if;
  if b.commission_mode='NONE' then return 0;
  elsif b.commission_mode='INDIVIDUAL' then
    insert into public.commission_distributions(bill_id,user_id,user_name_snapshot,amount,commission_mode,created_at)
    select b.id,s.id,s.name_en,b.commission,'INDIVIDUAL',completed_at_value from public.staff s where s.id=b.staff_id and s.active and s.commission_eligible on conflict(bill_id,user_id) do nothing;
  elsif b.commission_mode='ON_WORK_ALL' then
    insert into public.commission_distributions(bill_id,user_id,user_name_snapshot,amount,commission_mode,created_at)
    select b.id,s.id,s.name_en,b.commission,'ON_WORK_ALL',completed_at_value from public.staff s where s.active and s.commission_eligible and s.primary_branch=b.branch_id and exists(select 1 from public.attendance a where a.staff_id=s.id and a.branch_id=b.branch_id and a.clock_in<=completed_at_value and (a.clock_out is null or a.clock_out>completed_at_value)) on conflict(bill_id,user_id) do nothing;
  end if;
  select count(*) into recipient_count from public.commission_distributions where bill_id=b.id and reversed_at is null;
  return recipient_count;
end; $$;
revoke all on function public.materialize_bill_commission(uuid) from public;
grant execute on function public.materialize_bill_commission(uuid) to authenticated;

create or replace function public.set_bill_commission_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare branch_mode text;
begin
  if new.commission_mode is null or new.commission_mode='INDIVIDUAL' then select coalesce(commission_mode,'INDIVIDUAL') into branch_mode from public.branches where id=new.branch_id; if branch_mode is not null then new.commission_mode:=branch_mode; end if; end if;
  if new.status::text in ('approved','paid') and (tg_op='INSERT' or old.status is distinct from new.status) and new.completed_at is null then new.completed_at:=now(); end if;
  return new;
end; $$;
drop trigger if exists bills_set_commission_mode on public.bills;
create trigger bills_set_commission_mode before insert or update of branch_id,commission_mode,status on public.bills for each row execute function public.set_bill_commission_mode();

create or replace function public.create_bill_commission_distributions()
returns trigger language plpgsql security definer set search_path=public as $$
begin if new.status::text in ('approved','paid') and (tg_op='INSERT' or old.status is distinct from new.status) and new.commission>0 then perform public.materialize_bill_commission(new.id); end if; return new; end; $$;
drop trigger if exists bills_create_commission_distributions on public.bills;
create trigger bills_create_commission_distributions after insert or update of status on public.bills for each row execute function public.create_bill_commission_distributions();

create or replace function public.reverse_bill_commission_distributions()
returns trigger language plpgsql security definer set search_path=public as $$
begin if new.status::text in ('rejected','cancelled') and old.status::text is distinct from new.status then update public.commission_distributions set reversed_at=coalesce(reversed_at,now()) where bill_id=new.id and reversed_at is null and paid_at is null; end if; return new; end; $$;
drop trigger if exists bills_reverse_commission_distributions on public.bills;
create trigger bills_reverse_commission_distributions after update of status on public.bills for each row execute function public.reverse_bill_commission_distributions();

do $$ declare bill_id_value uuid; begin for bill_id_value in select id from public.bills where status::text in ('approved','paid') and commission>0 loop perform public.materialize_bill_commission(bill_id_value); end loop; end $$;
