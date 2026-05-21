-- Issue #220 PR1: Harvest booking foundation (v1)

alter table public.harvest_bookings
  add column if not exists expected_date_from date,
  add column if not exists expected_date_to date,
  add column if not exists estimated_tonnage numeric(12,3),
  add column if not exists requires_dryer boolean,
  add column if not exists estimated_moisture numeric(5,2);

-- align legacy status flow with v1 foundation
alter table public.harvest_bookings
  alter column status set default 'planned';

alter table public.harvest_bookings
  drop constraint if exists harvest_bookings_status_check;

alter table public.harvest_bookings
  add constraint harvest_bookings_status_check
  check (status in ('planned','pending','confirmed','completed','cancelled'));
