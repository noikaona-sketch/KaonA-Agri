-- Migration: harvest_bookings — expected vs actual foundation
-- Issue P2 PR5
--
-- Background:
--   actual_yield_kg already exists but is used as farmer's pre-fill estimate (PR1).
--   This migration adds SEPARATE actual columns for factory-measured values.
--
-- Columns added:
--   actual_received_kg   — weight actually received at factory (scale measurement)
--   actual_moisture_pct  — moisture % measured at factory (≠ estimated_moisture_pct)
--   completed_at         — timestamp when booking was marked completed
--
-- NOT in this PR:
--   economics fields (price_paid, deductions, net_amount) — deferred to PR6+
--   yield_variance computed column — deferred
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.harvest_bookings
  add column if not exists actual_received_kg  numeric(12, 2),
  add column if not exists actual_moisture_pct numeric(5, 1),
  add column if not exists actual_completed_at timestamptz;

comment on column public.harvest_bookings.actual_received_kg
  is 'Factory scale weight — actual received kg (≠ actual_yield_kg farmer estimate)';
comment on column public.harvest_bookings.actual_moisture_pct
  is 'Factory-measured moisture % (≠ estimated_moisture_pct farmer estimate)';
comment on column public.harvest_bookings.actual_completed_at
  is 'Timestamp when actual harvest data was recorded and booking completed';
