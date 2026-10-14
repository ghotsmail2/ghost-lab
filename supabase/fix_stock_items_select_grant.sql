-- Restore the authenticated read grant used by the Stock screen.
-- Row Level Security remains enabled and continues to limit visible rows.
grant select on table public.stock_items to authenticated;
