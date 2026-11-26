alter table public.services
  add column if not exists show_in_new_bill boolean not null default true;
