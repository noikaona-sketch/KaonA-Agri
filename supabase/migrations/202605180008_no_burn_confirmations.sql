-- Migration: no_burn_confirmations — community confirmation layer
-- Issue #218 PR2B — positive community verification
--
-- Purpose: allow trusted community members (leaders, nearby farmers,
-- any approved member) to provide positive confirmation that a no-burn
-- request appears genuine. This is supportive evidence — not a verdict.
--
-- Design principles:
--   - Positive confirmation only. No accusation workflow.
--   - Any approved member can confirm (not limited to leader role).
--   - confirmation_type distinguishes who is confirming.
--   - Multiple confirmations per request allowed (additive evidence).
--   - Does not automatically change no_burn_requests.status — staff reviews.
--   - note is optional — a simple confirmation without explanation is valid.
--
-- confirmation_type values:
--   leader         — confirmer has role=leader in this system
--   nearby_member  — confirmer is a neighbouring farmer (any approved member)
--   self            — placeholder for self-attestation (future use)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.no_burn_confirmations (
  id                  uuid        primary key default gen_random_uuid(),

  -- The no-burn request being confirmed
  no_burn_request_id  uuid        not null
    references public.no_burn_requests(id) on delete cascade,

  -- Who is confirming (any approved member — not restricted to leader)
  confirmed_by        uuid        not null
    references public.members(id) on delete cascade,

  -- What role the confirmer is acting in
  confirmation_type   text        not null default 'nearby_member'
    check (confirmation_type in ('leader', 'nearby_member', 'self')),

  -- Optional context note
  note                text,

  created_at          timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_no_burn_confirmations_request
  on public.no_burn_confirmations(no_burn_request_id);

create index if not exists idx_no_burn_confirmations_confirmed_by
  on public.no_burn_confirmations(confirmed_by);

-- ── Prevent duplicate confirmation from same member on same request ───────
create unique index if not exists idx_no_burn_confirmations_unique
  on public.no_burn_confirmations(no_burn_request_id, confirmed_by);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.no_burn_confirmations enable row level security;

-- Any approved member can read confirmations (community transparency)
create policy nbc_select_approved
  on public.no_burn_confirmations for select
  using (
    exists (
      select 1 from public.members m
      where m.auth_user_id = auth.uid()
        and m.status = 'approved'
    )
  );

-- Any approved member can submit a confirmation (positive only — no accusation)
create policy nbc_insert_approved
  on public.no_burn_confirmations for insert
  with check (
    confirmed_by = (
      select id from public.members
      where auth_user_id = auth.uid()
        and status = 'approved'
      limit 1
    )
  );

-- Members can delete their own confirmation (change of mind)
create policy nbc_delete_own
  on public.no_burn_confirmations for delete
  using (
    confirmed_by = (
      select id from public.members
      where auth_user_id = auth.uid()
      limit 1
    )
  );

-- service_role bypasses RLS for admin/API routes
