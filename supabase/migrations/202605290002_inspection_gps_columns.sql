-- Migration: inspections — gps columns + photo_count helper
-- ─────────────────────────────────────────────────────────────────────────────
-- The field API (PATCH /api/field/inspections) already references gps_lat/gps_lng
-- but those columns were never added to the table. This migration adds them.
-- Also adds inspector_note_at to track when result was submitted.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inspections
  add column if not exists gps_lat         numeric(10,7),
  add column if not exists gps_lng         numeric(10,7),
  add column if not exists gps_accuracy    numeric(10,2),
  add column if not exists inspector_submitted_at timestamptz;

comment on column public.inspections.gps_lat is
  'Inspector GPS latitude captured at time of field visit';
comment on column public.inspections.gps_lng is
  'Inspector GPS longitude captured at time of field visit';
comment on column public.inspections.inspector_submitted_at is
  'When the inspector submitted the result (visited_at = actual visit, this = form submit time)';
