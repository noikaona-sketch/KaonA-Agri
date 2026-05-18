-- Migration: service_bookings table
-- Issue #131 — Service booking MVP (tractor / harvester / transport)
--
-- Scope: booking request persistence + member own-row read + admin queue view.
-- Out of scope: scheduling engine, slots, calendar, auto assignment, payment.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.service_bookings (
  id                   uuid        primary key default gen_random_uuid(),

  -- requester — always resolved server-side, never from client body
  member_id            uuid        not null references public.members(id) on delete cascade,

  -- booking fields
  service_type         text        not null
    check (service_type in ('tractor', 'harvester', 'transport')),
  scheduled_date       date        not null,
  note                 text,

  -- status lifecycle (no auto transition — admin/staff updates manually)
  -- Status lifecycle for MVP scope only.
  -- in_progress / dispatch are out of scope until scheduling engine is added.
  status               text        not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),

  -- assignment (set by admin/staff — nullable at creation)
  assigned_to_member_id uuid       references public.members(id) on delete set null,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_service_bookings_member
  on public.service_bookings(member_id);

create index if not exists idx_service_bookings_status
  on public.service_bookings(status);

create index if not exists idx_service_bookings_date
  on public.service_bookings(scheduled_date);

-- ── updated_at trigger ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- only create if trigger doesn't exist (function is shared)
do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_service_bookings_updated_at'
      and tgrelid = 'public.service_bookings'::regclass
  ) then
    execute $t$
      create trigger trg_service_bookings_updated_at
        before update on public.service_bookings
        for each row execute function public.set_updated_at()
    $t$;
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.service_bookings enable row level security;

-- Member: read own bookings (requires valid session with auth_user_id linked)
create policy sb_member_select
  on public.service_bookings
  for select
  using (
    member_id = (
      select id from public.members
      where auth_user_id = auth.uid()
      limit 1
    )
  );

-- Member: insert own booking (member_id enforced server-side, but RLS also
-- guards so a client cannot insert a row for a different member)
create policy sb_member_insert
  on public.service_bookings
  for insert
  with check (
    member_id = (
      select id from public.members
      where auth_user_id = auth.uid()
      limit 1
    )
  );

-- Admin / staff: full read access to all bookings for queue view
-- Reuses the admin_role_check pattern from existing migrations.
create policy sb_admin_select
  on public.service_bookings
  for select
  using (
    exists (
      select 1 from public.member_roles mr
      join public.members m on m.id = mr.member_id
      where m.auth_user_id = auth.uid()
        and mr.role in ('admin', 'staff')
        and m.status = 'approved'
    )
  );

-- Admin / staff: update status + assigned_to (confirm / complete / cancel)
create policy sb_admin_update
  on public.service_bookings
  for update
  using (
    exists (
      select 1 from public.member_roles mr
      join public.members m on m.id = mr.member_id
      where m.auth_user_id = auth.uid()
        and mr.role in ('admin', 'staff')
        and m.status = 'approved'
    )
  );

-- service_role (server API routes) bypass RLS entirely — no policy needed.
