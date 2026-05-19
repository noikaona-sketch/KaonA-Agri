-- Migration: harvest_bookings — P2 v1 forecast fields
-- Issue P2 PR1 — Harvest Operation MVP
--
-- Purpose: add farmer estimate/forecast fields to harvest_bookings.
-- P2 v1 is forecasting only — not logistics optimisation.
--
-- Columns added:
--   drying_preference  — farmer's drying intent before delivery
--   delivery_type      — how produce will arrive at factory
--   estimated_moisture_pct — farmer's moisture estimate at harvest time
--   moisture_source    — how the estimate was derived
--
-- NOT added in P2 v1 (deferred):
--   requested_delivery_date — avoided to prevent duplicate scheduling states
--                             (scheduled_date already represents timing)
--   factory_site_id         — no factory_sites table yet
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.harvest_bookings
  -- Farmer's drying intent
  add column if not exists drying_preference text
    check (drying_preference in ('required', 'optional', 'not_required', 'unknown'))
    default 'unknown',

  -- How produce will arrive at factory
  -- fresh     = ยังไม่ผ่านการอบ (สด)
  -- field_dry = ผึ่งแห้งในแปลง/ลาน ไม่ใช้เครื่องอบ
  -- unknown   = ยังไม่ตัดสินใจ
  add column if not exists delivery_type text
    check (delivery_type in ('fresh', 'field_dry', 'unknown'))
    default 'unknown',

  -- Farmer's moisture estimate before harvest (not actual measured value)
  -- actual moisture goes to quality_moisture after factory measurement
  add column if not exists estimated_moisture_pct numeric(5, 1),

  -- How the estimate was derived
  add column if not exists moisture_source text
    check (moisture_source in ('farmer_estimate', 'field_test', 'factory_measure'));

comment on column public.harvest_bookings.drying_preference    is 'Farmer drying intent: required=ต้องการอบ, optional=อาจอบ, not_required=ไม่ต้องการ, unknown';
comment on column public.harvest_bookings.delivery_type        is 'fresh=ส่งสด, field_dry=ผึ่งแห้งเอง, unknown=ยังไม่ตัดสินใจ';
comment on column public.harvest_bookings.estimated_moisture_pct is 'Farmer estimate before harvest — not actual. Actual goes to quality_moisture.';
comment on column public.harvest_bookings.moisture_source      is 'How moisture estimate was derived';
