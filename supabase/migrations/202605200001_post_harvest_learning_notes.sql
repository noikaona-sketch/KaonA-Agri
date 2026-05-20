-- Migration: harvest_bookings — post-harvest learning notes (simple admin tagging)
-- Purpose: allow lightweight operational reason tags + optional short note after completion.

alter table public.harvest_bookings
  add column if not exists post_harvest_tags text[];

comment on column public.harvest_bookings.post_harvest_tags
  is 'Admin-only lightweight post-harvest learning tags. No scoring or automation.';

alter table public.harvest_bookings
  drop constraint if exists harvest_bookings_post_harvest_tags_check;

alter table public.harvest_bookings
  add constraint harvest_bookings_post_harvest_tags_check
  check (
    post_harvest_tags is null
    or (
      cardinality(post_harvest_tags) <= 8
      and post_harvest_tags <@ array[
        'rain_came_early',
        'harvester_unavailable',
        'transport_delay',
        'high_moisture',
        'lower_yield_than_expected',
        'farmer_rescheduled',
        'other'
      ]::text[]
    )
  );
