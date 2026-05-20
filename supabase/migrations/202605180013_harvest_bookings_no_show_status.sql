-- Migration: harvest_bookings — add no_show status
-- Issue P2 PR12
--
-- no_show = member had a confirmed booking but did not show up / deliver.
-- Separates no-shows from mutual cancellations.
--
-- Before: status in ('pending','confirmed','completed','cancelled')
-- After:  status in ('pending','confirmed','completed','cancelled','no_show')
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.harvest_bookings
  drop constraint if exists harvest_bookings_status_check;

alter table public.harvest_bookings
  add constraint harvest_bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));

comment on column public.harvest_bookings.status is
  'pending | confirmed | completed | cancelled | no_show';
