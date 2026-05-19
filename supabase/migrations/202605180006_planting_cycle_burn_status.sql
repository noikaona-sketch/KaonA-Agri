-- Migration: planting_cycles — burn/no-burn continuity tracking
-- Issue #217 — Cross-crop no-burn continuity
--
-- Purpose: allow members to self-declare burn practice per planting cycle.
-- This is a simple tracking layer — not a verification or scoring engine.
-- Future PR can link burn_practice outcome to no_burn_requests.status
-- once a member completes the no-burn flow for the same cycle.
--
-- burn_practice:
--   no_burn  — member declares they did not burn
--   burn     — member declares they burned (tracked for their own insight)
--   partial  — partial burn (e.g. neighbouring field spread)
--   unknown  — default; not yet declared
--
-- Design: member self-declares only in this PR.
-- Linking to no_burn_requests outcome is a follow-up (PR2).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.planting_cycles
  add column if not exists burn_practice      text
    check (burn_practice in ('no_burn', 'burn', 'partial', 'unknown'))
    default 'unknown',
  add column if not exists burn_practice_note text;

-- Index for future aggregation / community stats
create index if not exists idx_planting_cycles_burn_practice
  on public.planting_cycles(member_id, burn_practice)
  where burn_practice is not null and burn_practice <> 'unknown';
