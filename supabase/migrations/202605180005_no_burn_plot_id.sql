-- Migration: no_burn_requests missing columns
-- Issue #132 — No-Burn MVP
--
-- Bug fix: app/no-burn/page.tsx inserts plot_id but the column never existed.
-- Added 3 columns required for the MVP flow:
--   plot_id          — which plot this request covers
--   consent_accepted — member must confirm before submission
--   note             — optional free-text note from member
--
-- No status model change. No RLS change. Small migration only.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.no_burn_requests
  add column if not exists plot_id          uuid references public.plots(id) on delete set null,
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists note             text;

create index if not exists idx_no_burn_requests_plot
  on public.no_burn_requests(plot_id)
  where plot_id is not null;
