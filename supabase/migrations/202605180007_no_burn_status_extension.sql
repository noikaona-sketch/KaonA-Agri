-- Migration: no_burn_requests status extension
-- Issue #218 PR2A — advanced verification model
--
-- Adds two new statuses to reflect real-world edge cases
-- without forcing binary pass/fail outcomes:
--
--   anomaly        — unusual situation detected (neighbouring fire, accidental,
--                    partial damage). Does NOT automatically fail participation.
--                    Staff reviews context before deciding outcome.
--
--   seeking_support — member has flagged they need guidance or have a question.
--                    Positive, supportive entry point — not punitive.
--
-- Existing statuses preserved:
--   submitted / under_review / inspection_required / approved / rejected / completed
--
-- No automation. No scoring. No transition logic.
-- Admin and member UI renders new statuses — no new transition buttons in PR2A.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.no_burn_requests
  drop constraint if exists chk_no_burn_requests_status;

alter table public.no_burn_requests
  add constraint chk_no_burn_requests_status
  check (status in (
    'submitted',
    'under_review',
    'inspection_required',
    'approved',
    'rejected',
    'completed',
    'anomaly',          -- unusual situation — review context before deciding
    'seeking_support'   -- member requests guidance — supportive, not punitive
  ));
