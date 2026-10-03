-- Make Gold cashback real and idempotent.
-- Cashback is credited when a member bill is created/approved/paid, and is
-- reversed when a bill is cancelled or deleted through the existing RPC.

create table if not exists public.member_wallets (
  member_id uuid primary key references public.members(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount integer not null,
  transaction_type text not null check (transaction_type in ('cashback','redeem','adjustment','expiry')),
  bill_id uuid references public.bills(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_cashback_bill_uidx
  on public.wallet_transactions(member_id, bill_id)
  where transaction_type = 'cashback' and bill_id is not null;
create index if not exists wallet_transactions_member_created_idx
  on public.wallet_transactions(member_id, created_at desc);

create or replace function public.credit_member_cashback_for_bill()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_tier text;
  expires_at timestamptz;
  cashback_percent numeric := 0;
  cashback_amount integer := 0;
  inserted_transaction_id uuid;
begin
  if new.status::text not in ('approved', 'paid') or new.member_id is null or new.total <= 0
     or (tg_op = 'UPDATE' and old.status::text in ('approved', 'paid')) then
    return new;
  end if;
  select lower(case when m.tier = 'regular' then 'chill' else m.tier end), m.membership_expires_at,
         coalesce(t.cashback_percent, 0)
    into member_tier, expires_at, cashback_percent
  from public.members m
  left join public.membership_tiers t
    on t.key = lower(case when m.tier = 'regular' then 'chill' else m.tier end) and t.active
  where m.id = new.member_id;
  if member_tier is null or member_tier <> 'gold' or expires_at is null
     or expires_at < coalesce(new.created_at, now()) or cashback_percent <= 0 then
    return new;
  end if;
  cashback_amount := round((new.total * least(cashback_percent, 3)) / 100.0)::integer;
  if cashback_amount <= 0 then return new; end if;

  insert into public.wallet_transactions(member_id, amount, transaction_type, bill_id, note)
  values (new.member_id, cashback_amount, 'cashback', new.id,
          format('Gold Cashback %s%% · Bill %s', trim(to_char(cashback_percent, 'FM999990.00')), new.bill_number))
  on conflict (member_id, bill_id) where transaction_type = 'cashback' and bill_id is not null
  do nothing returning id into inserted_transaction_id;
  if inserted_transaction_id is not null then
    insert into public.member_wallets(member_id, balance) values (new.member_id, cashback_amount)
    on conflict (member_id) do update set balance = public.member_wallets.balance + excluded.balance, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists bills_credit_member_cashback on public.bills;
create trigger bills_credit_member_cashback after insert or update of status on public.bills
for each row execute function public.credit_member_cashback_for_bill();

create or replace function public.reverse_member_cashback_for_bill()
returns trigger language plpgsql security definer set search_path = public as $$
declare cashback record;
begin
  if new.status::text not in ('cancelled', 'rejected') or old.status::text in ('cancelled', 'rejected') then return new; end if;
  for cashback in select member_id, amount from public.wallet_transactions
    where bill_id = new.id and transaction_type = 'cashback' and amount > 0 loop
    update public.member_wallets set balance = greatest(0, balance - cashback.amount), updated_at = now()
      where member_id = cashback.member_id;
    if not exists (select 1 from public.wallet_transactions where bill_id = new.id and transaction_type = 'adjustment' and amount = -cashback.amount) then
      insert into public.wallet_transactions(member_id, amount, transaction_type, bill_id, note)
      values (cashback.member_id, -cashback.amount, 'adjustment', new.id, 'Reverse Cashback · Bill cancelled');
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists bills_reverse_member_cashback on public.bills;
create trigger bills_reverse_member_cashback after update of status on public.bills
for each row execute function public.reverse_member_cashback_for_bill();

-- The existing delete_bill_with_reversals RPC removes child rows before the
-- bill. This BEFORE DELETE trigger restores the wallet before those rows are
-- removed, without replacing or weakening the RPC's actor authorization.
create or replace function public.remove_member_cashback_for_deleted_bill()
returns trigger language plpgsql security definer set search_path = public as $$
declare wallet_delta integer := 0;
begin
  select coalesce(sum(amount), 0)::integer into wallet_delta from public.wallet_transactions where bill_id = old.id;
  if old.member_id is not null and wallet_delta > 0 then
    update public.member_wallets set balance = greatest(0, balance - wallet_delta), updated_at = now()
      where member_id = old.member_id;
  end if;
  delete from public.wallet_transactions where bill_id = old.id;
  return old;
end;
$$;

drop trigger if exists bills_remove_member_cashback on public.bills;
create trigger bills_remove_member_cashback before delete on public.bills
for each row execute function public.remove_member_cashback_for_deleted_bill();

revoke all on function public.credit_member_cashback_for_bill() from public;
revoke all on function public.reverse_member_cashback_for_bill() from public;
revoke all on function public.remove_member_cashback_for_deleted_bill() from public;
