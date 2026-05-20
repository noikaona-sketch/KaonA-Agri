-- PR21: Planting Economics Foundation (simple fields only)
-- Scope:
-- - planting_cycles simple economics inputs
-- - no complex accounting, no scoring, no AI recommendation

alter table public.planting_cycles
  add column if not exists expected_yield_per_rai_kg numeric(12,2),
  add column if not exists expected_price_per_kg numeric(12,2),
  add column if not exists expected_cost_per_rai numeric(12,2),
  add column if not exists expected_cost_per_rai_burn numeric(12,2),
  add column if not exists expected_cost_per_rai_no_burn numeric(12,2);
