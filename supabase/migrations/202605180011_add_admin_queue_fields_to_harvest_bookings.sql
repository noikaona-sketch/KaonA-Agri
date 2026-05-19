-- Migration: harvest_bookings — admin planning fields
-- Issue #253 — Admin Harvest Queue visibility + manual planning
--
-- Adds 4 nullable columns for admin manual planning only.
-- No auto-scheduling. No queue_position. No optimization engine.
--
-- admin_note     — separate from farmer's `note` column.
--                  farmer note = context from member at booking time.
--                  admin_note  = internal planning/dispatch note by staff.
--
-- planned_delivery_date — admin's target delivery date to factory.
--                         Separate from scheduled_date (farmer's harvest estimate).
--
-- assigned_dryer — text label for dryer assignment (e.g. "เครื่องอบ 2").
--                  Simple text, not a FK — no dryer table exists yet.
--
-- priority_score — manual metadata only. Admin sets if needed.
--                  NOT used for auto sorting or optimization.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.harvest_bookings
  add column if not exists planned_delivery_date date,
  add column if not exists assigned_dryer        text,
  add column if not exists admin_note            text,
  add column if not exists priority_score        numeric;

comment on column public.harvest_bookings.admin_note
  is 'Internal staff note — separate from farmer note';
comment on column public.harvest_bookings.planned_delivery_date
  is 'Admin target delivery date — separate from scheduled_date (harvest estimate)';
comment on column public.harvest_bookings.assigned_dryer
  is 'Manual dryer label, e.g. เครื่องอบ 2 — not a FK';
comment on column public.harvest_bookings.priority_score
  is 'Manual priority metadata — not used for auto scheduling';
