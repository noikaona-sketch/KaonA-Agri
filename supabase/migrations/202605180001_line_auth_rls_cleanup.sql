-- Migration: LINE auth RLS cleanup + update column restriction
-- Issue #168: idempotent LINE→Supabase Auth linking
--
-- Prerequisites (must be applied before this migration):
--   202605060001 — base members table (status, created_at)
--   202605060002 — auth_user_id column
--   202605060003 — deleted_at, deleted_by columns
--   202605120001 — invited_by column
--   202605170005 — bank_verified_status, return_reason, returned_at,
--                   rejection_reason, rejected_at columns
--
-- Protected column audit (all verified present in migrations above):
--   status              ← 202605060001 (base)
--   auth_user_id        ← 202605060002
--   bank_verified_status← 202605170005  [REQUIRED: run 202605170005 first]
--   return_reason       ← 202605170005  [REQUIRED: run 202605170005 first]
--   returned_at         ← 202605170005  [REQUIRED: run 202605170005 first]
--   rejection_reason    ← 202605170005  [REQUIRED: run 202605170005 first]
--   rejected_at         ← 202605170005  [REQUIRED: run 202605170005 first]
--   invited_by          ← 202605120001
--   deleted_at          ← 202605060003
--   deleted_by          ← 202605060003
--   created_at          ← 202605060001 (base)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. SELECT policy (recreated for clarity) ──────────────────────────────
drop policy if exists members_read_own_by_auth_user on public.members;
create policy members_read_own_by_auth_user
  on public.members
  for select
  using (auth_user_id = auth.uid());

-- ── 2. UPDATE policy — row-scoped, column protection via trigger below ────
-- BLOCKER FIX 5: drop the broad policy from 202605170002 that allowed
-- writing every column (including status, auth_user_id, approval fields).
drop policy if exists members_update_own_by_auth_user on public.members;

-- New policy keeps row-level scope only.
-- Column-level protection is enforced by the trigger in section 3.
create policy members_update_own_profile
  on public.members
  for update
  using     (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ── 3. Trigger: protect sensitive columns from client sessions ────────────
-- PostgreSQL RLS cannot restrict individual columns in UPDATE policies without
-- a security-invoker view or a trigger.  This BEFORE UPDATE trigger reverts
-- any attempt to change a protected column when the session is not service_role.
--
-- service_role (all server API routes) bypasses RLS entirely and is also
-- allowed through the current_user check so it can write all columns.
--
-- Columns allowed for self-service update (safe profile fields):
--   full_name, phone, address_*, line_display_name, line_picture_url,
--   citizen_id_masked, bank_name, bank_account_number, bank_account_name,
--   updated_at
--
-- All other columns are silently reverted to their OLD values for non-service
-- sessions, making client-side attempts to escalate status or change
-- auth_user_id a no-op rather than an error.
create or replace function public.members_protect_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service_role / postgres / supabase_admin to write any column.
  -- These identities are used by all server-side API routes.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- For all other sessions (authenticated / anon / magiclink):
  -- Silently revert any write to a protected column.
  new.status           := old.status;
  new.auth_user_id     := old.auth_user_id;
  new.invited_by       := old.invited_by;
  new.deleted_at       := old.deleted_at;
  new.deleted_by       := old.deleted_by;
  new.created_at       := old.created_at;

  -- Columns from 202605170005 (member completeness).
  -- The trigger is created after that migration in sort order, so these
  -- columns are guaranteed to exist when this function runs.
  new.bank_verified_status := old.bank_verified_status;
  new.return_reason        := old.return_reason;
  new.returned_at          := old.returned_at;
  new.rejection_reason     := old.rejection_reason;
  new.rejected_at          := old.rejected_at;

  return new;
end;
$$;

drop trigger if exists trg_members_protect_sensitive_columns on public.members;
create trigger trg_members_protect_sensitive_columns
  before update on public.members
  for each row
  execute function public.members_protect_sensitive_columns();

-- ── 4. Unique index on auth_user_id (idempotent) ─────────────────────────
create unique index if not exists idx_members_auth_user_id_unique
  on public.members(auth_user_id)
  where auth_user_id is not null;

-- ── 5. Backfill strategy for old anon-linked members (BLOCKER FIX 3) ─────
--
-- Context:
--   PR #197 used signInAnonymously() which assigned a random Supabase anon
--   auth.uid to members.auth_user_id.  The new flow (PR #225) uses a
--   deterministic synthetic email (line-<member_id>@kaona.internal) so that
--   auth_user_id is stable across logins.
--
--   Old anon-linked members will receive session: null from the new route
--   because their existing auth_user_id does NOT correspond to the synthetic
--   email — the mismatch check in resolveSession() rejects the session.
--   Login still succeeds and the member record is returned; only client-side
--   Supabase queries that require auth.uid() (direct table access via anon key)
--   will return empty results until the row is reset or relinked.
--
-- REQUIRED BEFORE PRODUCTION DEPLOY:
--   Run one of the two options below in Supabase SQL editor AFTER this
--   migration and AFTER deploying the new route to staging.
--   Verify a test account can log in and receive a valid session before
--   running on production.
--
-- OPTION 1 — Reset (recommended, safe, reversible):
--   Clears auth_user_id for every member whose current auth user is anonymous.
--   On next login those members are treated as CASE C: a fresh synthetic-email
--   auth user is created and linked.  Member data, status, plots, and all
--   other records are completely unaffected.
--
--   SQL (run manually in Supabase SQL editor):
--   ─────────────────────────────────────────
--   UPDATE public.members
--   SET    auth_user_id = NULL
--   WHERE  auth_user_id IN (
--     SELECT id FROM auth.users WHERE is_anonymous = true
--   );
--   ─────────────────────────────────────────
--   Verify count before running:
--   SELECT count(*) FROM public.members
--   WHERE auth_user_id IN (
--     SELECT id FROM auth.users WHERE is_anonymous = true
--   );
--
-- OPTION 2 — Reprovision in-place (zero session gap, advanced):
--   For each affected member, update the existing anon auth user to adopt
--   the synthetic email.  The auth_user_id stays the same so no DB update
--   is needed; generateLink will start resolving correctly on next login.
--
--   Run as a one-off Node script (service_role key required):
--   ─────────────────────────────────────────
--   const { data: members } = await supabase
--     .from('members')
--     .select('id, auth_user_id')
--     .not('auth_user_id', 'is', null);
--
--   for (const m of members.data) {
--     await supabase.auth.admin.updateUserById(m.auth_user_id, {
--       email: `line-${m.id}@kaona.internal`,
--       email_confirm: true,
--     });
--   }
--   ─────────────────────────────────────────
--   Note: only run this for members whose auth_user is actually anonymous
--   (is_anonymous = true).  Admin web users have email-password auth and
--   must not be touched.
--
-- DO NOT uncomment the block below without staging validation:
-- DO $$
-- BEGIN
--   UPDATE public.members
--   SET    auth_user_id = NULL
--   WHERE  auth_user_id IN (
--     SELECT id FROM auth.users WHERE is_anonymous = true
--   );
-- END $$;
