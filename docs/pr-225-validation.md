# PR #225 — Staging validation checklist (LINE login)

Related: #168. This docs-only PR does not close #168.

## Scope
Validate the LINE login + Supabase session linkage flow introduced in PR #225.

## Preconditions
1. Apply migration `supabase/migrations/202605180001_line_auth_rls_cleanup.sql`.
2. Ensure LINE provider is configured in Supabase Auth and matches LIFF channel.
3. Deploy the updated `/api/auth/line` route to staging.

## Test matrix (required)
- [ ] New LINE member login
- [ ] Existing member login
- [ ] Old anonymous-linked member
- [ ] Approved + pending member

## Assertions per test
- [ ] `members.auth_user_id` is not null after successful login (new/old relink cases)
- [ ] Returned session user id equals `members.auth_user_id`
- [ ] `supabase.auth.getSession()` works in browser (session is non-null)
- [ ] Representative RLS queries pass with `auth.uid()` mapping via `members.auth_user_id`

## SQL checks
```sql
-- 1) confirm linkage row
select id, line_user_id, auth_user_id, status
from public.members
where line_user_id = :line_user_id;

-- 2) optional: inspect old anon-linked accounts before reset option
select count(*) as anon_linked_members
from public.members
where auth_user_id in (
  select id from auth.users where is_anonymous = true
);
```

## Browser checks
1. Login via LINE in LIFF mini app.
2. Open debug screen and verify `supabase.auth.getSession()` returns a session.
3. Verify a page that reads member-scoped data via browser client returns data (not empty due to auth mismatch).

## Migration / rollout instruction
For old anonymous-linked members, run one backfill approach documented in the migration comments:
- **Option 1 (recommended):** reset `members.auth_user_id` to null for anonymous auth users; relink on next login.
- **Option 2 (advanced):** reprovision anon auth users to synthetic email in-place.

Run this in **staging first**, then promote to production after validation evidence is attached.
