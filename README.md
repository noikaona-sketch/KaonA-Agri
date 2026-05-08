# KaonA-Agri

KaonA Agri-lineOA.

## Deployment / environment stability

Set these public environment variables in local `.env.local` and in your deployment platform (for example Vercel Project Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL` (required)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `NEXT_PUBLIC_LIFF_ID` (optional; LIFF bootstrap is skipped when missing)

## Supabase LINE provider setup (required for LIFF session bridge)

The LIFF entry flow exchanges a LINE ID token into a Supabase Auth session using `signInWithIdToken`. For this to work, configure LINE in Supabase Auth first:

1. Open **Supabase Dashboard → Authentication → Providers**.
2. Enable the **LINE** provider (OIDC).
3. Set the LINE **Channel ID** and **Channel Secret** from LINE Developers Console.
4. Confirm the LIFF app/channel used by `NEXT_PUBLIC_LIFF_ID` belongs to the same LINE channel configured in Supabase.
5. Save provider settings and test login in the deployed URL using LIFF webview.

If LINE provider is not enabled or channel values do not match, LIFF can be logged in but Supabase session exchange will fail and app access remains unauthenticated.

The app now fails fast with a clear error message when required public variables are missing, which helps prevent unstable deployments caused by partially configured environments.

## Demo seed accounts + RLS validation

For local QA, create demo users in **both** Supabase Auth and `public.members`:

1. Create an Auth user (Supabase dashboard or seed script).
2. Insert/update a `public.members` row with `members.auth_user_id = auth.users.id`.
3. Add one or more rows in `public.member_roles` for that member.

RLS policies resolve access by translating `auth.uid()` to a domain member via `members.auth_user_id`, then checking ownership/role predicates. If `auth_user_id` is missing or mismatched, the account will authenticate but will fail RLS checks and return empty/forbidden results.

Recommended demo role matrix for validation:

- `farmer`: own records only.
- `leader`: own records unless explicitly expanded by policy.
- `staff` / `admin`: cross-member operational access.
- `service_account`: system-level role intended for backend automation only (not LIFF end-user selection).
