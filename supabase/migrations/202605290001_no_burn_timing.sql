-- Migration: no_burn_requests — timing field
-- ─────────────────────────────────────────────────────────────────────────────
-- Purpose: allow members to specify WHEN they intend to not burn:
--   before_planting — pledge made before the planting cycle starts
--   after_planting  — pledge made after the cycle has already begun
--
-- This is purely informational at this stage.
-- planting_cycle_id remains optional for both timings.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.no_burn_requests
  add column if not exists timing text
    check (timing in ('before_planting', 'after_planting'))
    default 'after_planting';

comment on column public.no_burn_requests.timing is
  'before_planting = pledge before crop is in ground; after_planting = already planted';

create index if not exists idx_no_burn_requests_timing
  on public.no_burn_requests(timing)
  where timing is not null;
