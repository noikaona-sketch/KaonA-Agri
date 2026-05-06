# LINE LIFF Authentication + Role Access (Issue #4)

## Purpose
Define the MVP authentication and authorization flow for KaonA Agri LINE Mini App so all users sign in via LINE LIFF and receive role-scoped access based on backend policy.

## Scope
- **In scope:** LIFF login sequence, Supabase auth session exchange, role resolution, role-based route/app access, and minimum security controls.
- **Out of scope:** multi-tenant SSO federation, delegated role administration UX, and non-LINE identity providers.

## Supported Roles
- farmer
- leader
- inspector
- truck_owner
- staff
- admin
- service_account (system-only; no LIFF UI access)

## Auth Architecture (MVP)
1. User opens LIFF app from LINE.
2. Frontend checks LIFF session (`liff.isLoggedIn`).
3. If not logged in, trigger `liff.login()`.
4. Frontend obtains LINE ID token/profile from LIFF SDK.
5. Frontend sends token to backend auth endpoint.
6. Backend verifies token (issuer, audience/channel, signature, expiry).
7. Backend creates/links a Supabase Auth user for the LINE identity.
8. Backend stores LINE user id in `members.line_user_id`.
9. Backend stores Supabase Auth user id in `members.auth_user_id`.
10. Backend issues a Supabase session (JWT) for app API access.
11. App resolves effective role from `member_roles` and applies role-based navigation.


## Auth Identity Mapping (Required for Current RLS)
- LINE LIFF user id is stored in `members.line_user_id`.
- Supabase Auth user id is stored in `members.auth_user_id`.
- RLS resolves current member via `members.auth_user_id = auth.uid()`.
- `line_user_id` must not be used as the RLS identity key.

## Supabase Session Requirement
- LIFF login alone is not enough for Supabase RLS-protected table access.
- The app must establish a Supabase Auth session before accessing protected tables.
- Protected DB access should only occur after `auth_user_id` link is confirmed.

## Role Resolution Rules
- Role resolution source of truth is database (`member_roles`) not frontend claims.
- If multiple roles are assigned, choose by deterministic priority for MVP:
  1. admin
  2. staff
  3. inspector
  4. leader
  5. truck_owner
  6. farmer
- `service_account` cannot authenticate through LIFF and must use service credentials only.
- If no active role is found, route user to onboarding/pending-approval state.

## Access Control Model
- Authorization enforcement occurs in **three layers**:
  1. **UI guard**: hide/disable inaccessible modules.
  2. **API guard**: verify authenticated user and required action permission.
  3. **Database RLS**: final policy enforcement per row/action.
- Deny-by-default behavior is required across all layers.
- UI checks are advisory only; API + RLS checks are mandatory.

## MVP Permission Baseline
| Resource/Action | farmer | leader | inspector | truck_owner | staff | admin |
|---|---|---|---|---|---|---|
| View own member profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own profile fields (allowed set) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit field photo/evidence | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Create/update own plot/cycle | ✅ | ✅ (scoped) | ❌ | ❌ | ✅ | ✅ |
| Review approval queue | ❌ | advisory only | ❌ | ❌ | ✅ | ✅ |
| Submit inspection result | ❌ | ❌ | ✅ | ❌ | ✅ (if assigned) | ✅ |
| Manage role assignments | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Session and Token Requirements
- Use short-lived access token with refresh token flow handled by Supabase.
- Rotate refresh tokens on re-authentication events where supported.
- Store session using secure client storage strategy appropriate for LIFF webview.
- Force re-authentication when token validation fails or account is disabled.

## Security Controls (Minimum)
- Validate LINE token `exp`, `iss`, `aud`, and signature.
- Reject tokens that do not match configured LIFF channel.
- Enforce HTTPS for all auth exchange endpoints.
- Log auth events: login success/fail, role resolution result, denied access.
- Mask sensitive values in logs (token, citizen ID, PII).

## Error and State Handling
- **Unregistered LINE account:** redirect to member registration flow.
- **Registered but no approved role:** show pending approval status.
- **Role mismatch/access denied:** show friendly access denied screen + support path.
- **Backend unavailable:** show retry state and avoid partial login state.

## Acceptance Criteria (Issue #4)
1. LIFF sign-in is the only interactive login path for human MVP users.
2. Backend-verified identity is linked to member record with both `line_user_id` and `auth_user_id` before protected DB access.
3. RLS current-member resolution works through `auth.uid() -> members.auth_user_id -> members.id`.
4. Effective role is resolved from database and applied consistently to home/navigation.
5. API + RLS enforce deny-by-default authorization independent from UI guards.
6. Users without active approved roles are blocked from protected modules.
7. Security logging exists for auth success/failure and authorization deny events.

## Implementation Notes
- Keep frontend role checks centralized (single role-access utility).
- Keep API authorization middleware action-based (e.g., `inspection.submit`).
- Reuse existing Supabase RLS patterns for resource-level enforcement.
- Ensure all new role-gated flows map to the role list in `docs/user-roles-and-permissions.md`.
