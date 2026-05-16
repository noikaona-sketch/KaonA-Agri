-- Migration: make lot_id / lot_no / variety_id nullable in seed_reservations
-- Required for product_id-based reservation flow (no lot needed)
-- Also adds 'converted' to status CHECK so POS sale-order route does not fail

-- 1. lot_id nullable (was NOT NULL FK)
alter table public.seed_reservations
  alter column lot_id drop not null;

-- 2. lot_no nullable (was NOT NULL text)
alter table public.seed_reservations
  alter column lot_no drop not null;

-- 3. variety_id nullable (was NOT NULL FK)
alter table public.seed_reservations
  alter column variety_id drop not null;

-- 4. status CHECK — add 'converted' (POS sets this when reservation is sold)
alter table public.seed_reservations
  drop constraint if exists seed_reservations_status_check;

alter table public.seed_reservations
  add constraint seed_reservations_status_check
  check (status in ('pending','confirmed','completed','cancelled','converted'));
