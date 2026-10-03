-- Collaboration Membership system: configurable tiers, brands, campaigns,
-- promotions, rewards and wallet cashback. Run this file in Supabase SQL Editor.
create table if not exists public.membership_tiers (
  key text primary key check (key in ('chill','silver','gold')),
  display_name text not null,
  monthly_fee integer not null default 0 check (monthly_fee >= 0),
  discount_percent numeric(5,2) not null check (discount_percent between 0 and 7),
  cashback_percent numeric(5,2) not null default 0 check (cashback_percent between 0 and 3),
  benefits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.membership_tiers(key,display_name,monthly_fee,discount_percent,cashback_percent,benefits,sort_order)
values
 ('chill','CHILL MEMBER',0,3,0,'{"label":"3% OFF","event":true,"news":true,"basic_reward":true,"campaign_access":"chill"}',1),
 ('silver','SILVER MEMBER',25000,5,0,'{"label":"5% OFF","engine_repair_kit_monthly":1,"priority_queue":true,"member_event":true,"promotion":"silver","collaboration_items":true}',2),
 ('gold','GOLD MEMBER',50000,7,3,'{"label":"7% OFF","engine_repair_kit_monthly":2,"full_repair_kit_monthly":1,"vip_priority":true,"vip_event":true,"birthday_reward":true,"limited_items":true,"promotion":"gold","campaign_gift":true}',3)
on conflict (key) do update set display_name=excluded.display_name,monthly_fee=excluded.monthly_fee,discount_percent=excluded.discount_percent,cashback_percent=excluded.cashback_percent,benefits=excluded.benefits,sort_order=excluded.sort_order,active=true,updated_at=now();

create table if not exists public.brands (id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')),theme jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
insert into public.brands(code,name) values ('GHOSTLAB','GHOSTLAB'),('SABINAGISA','SABINAGISA'),('COLLAB','COLLAB') on conflict(code) do update set name=excluded.name,status='ACTIVE',updated_at=now();
alter table public.members add column if not exists brand_source text not null default 'COLLAB';
alter table public.members add column if not exists brand_id uuid references public.brands(id);
update public.members m set brand_source=case when upper(coalesce(b.key,'')) like '%GARAGE%' then 'GHOSTLAB' when upper(coalesce(b.key,'')) like '%SABINA%' then 'SABINAGISA' else 'COLLAB' end from public.branches b where b.id=m.branch_id and (m.brand_source is null or m.brand_source='COLLAB');
update public.members m set brand_id=b.id from public.brands b where b.code=m.brand_source and m.brand_id is null;
alter table public.members drop constraint if exists members_brand_source_check;
alter table public.members add constraint members_brand_source_check check (brand_source in ('GHOSTLAB','SABINAGISA','COLLAB'));

create table if not exists public.collaborations (id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','INACTIVE','ENDED')),start_date date,end_date date,banner text,theme jsonb not null default '{}'::jsonb,description text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.collaboration_brands (collaboration_id uuid references public.collaborations(id) on delete cascade,brand_id uuid references public.brands(id) on delete cascade,primary key(collaboration_id,brand_id));
insert into public.collaborations(code,name,status,description) values ('GL-SBN-001','GhostLab × SABINAGISA','ACTIVE','TWO SOULS, ONE GARAGE') on conflict(code) do update set name=excluded.name,status='ACTIVE',description=excluded.description,updated_at=now();
insert into public.collaboration_brands(collaboration_id,brand_id)
select c.id,b.id from public.collaborations c cross join public.brands b where c.code='GL-SBN-001' and b.code in ('GHOSTLAB','SABINAGISA') on conflict do nothing;
create table if not exists public.campaigns (id uuid primary key default gen_random_uuid(),collaboration_id uuid references public.collaborations(id) on delete set null,name text not null,description text,status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','INACTIVE','ENDED')),start_date date,end_date date,banner text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.promotions (id uuid primary key default gen_random_uuid(),promotion_name text not null,description text,campaign_id uuid references public.campaigns(id) on delete set null,brand_id uuid references public.brands(id) on delete set null,collaboration_id uuid references public.collaborations(id) on delete set null,start_date date,end_date date,eligible_tier text[] not null default array['chill','silver','gold'],discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 7),cashback_percent numeric(5,2) not null default 0 check(cashback_percent between 0 and 3),reward jsonb not null default '{}'::jsonb,free_item jsonb not null default '{}'::jsonb,usage_limit integer check(usage_limit is null or usage_limit>=0),usage_per_customer integer check(usage_per_customer is null or usage_per_customer>=0),minimum_spend integer not null default 0 check(minimum_spend>=0),status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','INACTIVE','ENDED')),banner_image text,badge text check(badge is null or badge in ('NEW','LIMITED','MEMBER ONLY','VIP','COLLAB','HOT','EXCLUSIVE')),priority integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.member_wallets (member_id uuid primary key references public.members(id) on delete cascade,balance integer not null default 0 check(balance>=0),updated_at timestamptz not null default now());
create table if not exists public.wallet_transactions (id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members(id) on delete cascade,amount integer not null,transaction_type text not null check(transaction_type in ('cashback','redeem','adjustment','expiry')),bill_id uuid references public.bills(id) on delete set null,promotion_id uuid references public.promotions(id) on delete set null,note text,created_at timestamptz not null default now());
create table if not exists public.rewards (id uuid primary key default gen_random_uuid(),code text unique,name text not null,description text,tier text check(tier is null or tier in ('chill','silver','gold')),free_item jsonb not null default '{}'::jsonb,active boolean not null default true,created_at timestamptz not null default now());
create index if not exists promotions_active_idx on public.promotions(status,start_date,end_date,priority desc);
create index if not exists members_brand_source_idx on public.members(brand_source);
alter table public.membership_tiers enable row level security; alter table public.brands enable row level security; alter table public.collaborations enable row level security; alter table public.collaboration_brands enable row level security; alter table public.campaigns enable row level security; alter table public.promotions enable row level security; alter table public.member_wallets enable row level security; alter table public.wallet_transactions enable row level security; alter table public.rewards enable row level security;
do $$ declare t text; begin foreach t in array array['membership_tiers','brands','collaborations','collaboration_brands','campaigns','promotions','rewards'] loop execute format('drop policy if exists %I_public_read on public.%I',t,t); execute format('create policy %I_public_read on public.%I for select to authenticated using(true)',t,t); execute format('drop policy if exists %I_admin_write on public.%I',t,t); execute format('create policy %I_admin_write on public.%I for all to authenticated using(exists(select 1 from public.staff s where s.auth_user_id=auth.uid() and s.role in (''owner'',''god''))) with check(exists(select 1 from public.staff s where s.auth_user_id=auth.uid() and s.role in (''owner'',''god'')))',t,t); end loop; end $$;
drop policy if exists member_wallets_own_read on public.member_wallets; create policy member_wallets_own_read on public.member_wallets for select to authenticated using(true);
drop policy if exists wallet_transactions_own_read on public.wallet_transactions; create policy wallet_transactions_own_read on public.wallet_transactions for select to authenticated using(true);
create or replace function public.membership_discount(p_tier text) returns numeric language sql immutable as $$ select coalesce((select discount_percent from public.membership_tiers where key=lower(p_tier) and active),3)::numeric; $$;
create or replace function public.membership_cashback(p_tier text) returns numeric language sql immutable as $$ select coalesce((select cashback_percent from public.membership_tiers where key=lower(p_tier) and active),0)::numeric; $$;
revoke all on function public.membership_discount(text) from public; grant execute on function public.membership_discount(text) to authenticated;
revoke all on function public.membership_cashback(text) from public; grant execute on function public.membership_cashback(text) to authenticated;
