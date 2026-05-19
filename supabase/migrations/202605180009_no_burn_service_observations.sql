-- Migration: no_burn_service_observations — service team evidence layer
-- Issue #218 PR2C — service team observation workflow
--
-- Purpose: allow service team members (truck_owner, inspector, staff)
-- who enter the field as part of their regular work to optionally report
-- what they observe about burn/no-burn conditions.
--
-- This is SUPPORTING EVIDENCE only — not final approval authority.
-- Observations are reviewed by staff alongside other evidence.
--
-- Design principles:
--   - Optional — service team is not required to report
--   - Neutral observation — not a verdict
--   - observed_condition reflects what was seen, not a judgment
--   - Staff still makes final decision on no_burn_requests.status
--   - Photo metadata links to existing public.photos table (photo_type='no_burn')
--
-- observed_condition values:
--   no_burn_signs      — visible signs of no-burn (residue, stubble intact)
--   burn_signs         — visible signs of burning (ash, charring)
--   partial_signs      — partial evidence (some areas burned, some not)
--   unclear            — unable to determine from field visit
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.no_burn_service_observations (
  id                  uuid        primary key default gen_random_uuid(),

  -- The no-burn request this observation relates to
  no_burn_request_id  uuid        not null
    references public.no_burn_requests(id) on delete cascade,

  -- Who is reporting (must have truck_owner, inspector, or staff role)
  observed_by         uuid        not null
    references public.members(id) on delete cascade,

  -- What service context led to this observation
  service_role        text        not null
    check (service_role in ('truck_owner', 'inspector', 'staff', 'admin')),

  -- What was observed — neutral, not a verdict
  observed_condition  text        not null
    check (observed_condition in ('no_burn_signs', 'burn_signs', 'partial_signs', 'unclear')),

  -- Optional note (e.g. "stubble intact, no ash visible")
  note                text,

  -- Optional GPS at time of observation (from device, nullable)
  lat                 numeric(10, 7),
  lng                 numeric(10, 7),
  accuracy            numeric(8, 2),

  -- Reference to photos uploaded (photo_type='no_burn' in public.photos)
  -- Observer may upload photos separately via existing /api/member/no-burn route
  -- This field is a convenience link — not enforced by FK to keep it optional
  observation_date    date        not null default current_date,

  created_at          timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_nbso_request
  on public.no_burn_service_observations(no_burn_request_id);

create index if not exists idx_nbso_observed_by
  on public.no_burn_service_observations(observed_by);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.no_burn_service_observations enable row level security;

-- Service team members can read all observations (for context when in field)
-- Admin/staff see all
create policy nbso_select
  on public.no_burn_service_observations for select
  using (
    exists (
      select 1
      from public.member_roles mr
      join public.members m on m.id = mr.member_id
      where m.auth_user_id  = auth.uid()
        and m.status        = 'approved'
        and mr.role         in ('truck_owner', 'inspector', 'staff', 'admin')
    )
  );

-- Only service team can insert observations (observed_by = caller)
create policy nbso_insert
  on public.no_burn_service_observations for insert
  with check (
    observed_by = (
      select m.id
      from public.members m
      join public.member_roles mr on mr.member_id = m.id
      where m.auth_user_id = auth.uid()
        and m.status       = 'approved'
        and mr.role        in ('truck_owner', 'inspector', 'staff', 'admin')
      limit 1
    )
  );

-- Service team can delete own observation (correction)
create policy nbso_delete_own
  on public.no_burn_service_observations for delete
  using (
    observed_by = (
      select id from public.members
      where auth_user_id = auth.uid()
      limit 1
    )
  );
