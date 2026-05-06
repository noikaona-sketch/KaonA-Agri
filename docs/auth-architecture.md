# Authentication Architecture (Issue #13)

## Purpose
Define the end-to-end authentication architecture for KaonA Agri so identity proofing, session issuance, and authorization are consistent across LIFF client, backend API, and Supabase RLS.

## Goals
- Use LINE LIFF as the only interactive identity provider for MVP users.
- Ensure backend-verifiable identity before any protected data access.
- Standardize session lifecycle, role resolution, and security logging.
- Keep authorization deny-by-default across UI, API, and database.

## Non-Goals (MVP)
- Multi-IdP federation (Google, Apple, enterprise SSO).
- Delegated admin role-management workflows.
- Cross-tenant identity boundary management.

## Components
- **LIFF client (webview app):** initiates LINE login and obtains LINE ID token.
- **Auth gateway/API:** verifies LINE token, links identity, and issues Supabase session.
- **Supabase Auth:** stores authenticated subject (`auth.uid()`) and manages token refresh.
- **App database (`members`, `member_roles`):** canonical identity link and role source-of-truth.
- **RLS policies:** final authorization enforcement for all table operations.

## Trust Boundaries
1. **Client boundary:** LIFF token must be treated as untrusted until backend verification.
2. **API boundary:** only validated token claims can be mapped to internal user records.
3. **Database boundary:** role/action checks must not rely on frontend claims.

## Identity Model
- External identity key: `line_user_id` (from LINE subject/profile identity).
- Internal auth principal: `auth_user_id` (Supabase Auth user UUID).
- Domain member identity: `members.id`.
- Required mapping chain for protected access:
  - `auth.uid()` -> `members.auth_user_id` -> `members.id` -> role lookup in `member_roles`.

## Authentication Flow
1. User opens LIFF app.
2. Client checks `liff.isLoggedIn()`.
3. If false, client triggers `liff.login()`.
4. Client obtains LINE ID token.
5. Client sends token to backend auth endpoint.
6. Backend validates token signature and claims (`iss`, `aud`, `exp`, nonce if used).
7. Backend upserts member linkage by `line_user_id` and ensures `auth_user_id` exists.
8. Backend returns/initializes Supabase session for that principal.
9. Client stores session and uses it for all protected API/database calls.
10. API/RLS resolve role from database and authorize each operation.

## Authorization Model
### Layered Enforcement
1. **UI guard:** navigation and component gating for UX only.
2. **API guard:** action-level authorization (required for all mutations).
3. **RLS guard:** row-level deny-by-default with explicit allow policies.

### Role Resolution
- Source of truth: `member_roles` table.
- Deterministic effective-role priority for MVP:
  1. admin
  2. staff
  3. inspector
  4. leader
  5. truck_owner
  6. farmer
- If no active role exists, user is authenticated but unauthorized for protected modules.

## Session Lifecycle
- Access tokens are short-lived and refreshed via Supabase refresh flow.
- Refresh token rotation is enabled where supported.
- Re-authentication is required when:
  - token validation fails,
  - account/member is disabled,
  - role status is revoked and policy demands immediate re-check.

## Security Controls
- Enforce HTTPS for auth endpoints and callbacks.
- Reject tokens with invalid audience/channel mapping.
- Store minimal PII in logs; never log raw tokens.
- Emit structured auth events:
  - login.success
  - login.failed
  - authz.denied
  - role.resolved
- Apply rate limits on auth endpoint and anti-replay nonce checks if available.

## Failure States
- **Unknown LINE user:** route to registration/onboarding.
- **Known user, no approved role:** show pending approval state.
- **Role denied:** show access-denied UI and support path.
- **Auth service unavailable:** fail closed and provide retry path.

## Data Contracts (Minimum)
### `POST /auth/line/exchange`
- **Input:** LINE ID token (+ optional LIFF metadata)
- **Output:** Supabase session tokens + effective role + member status
- **Errors:** `401 invalid_token`, `403 no_active_role`, `503 auth_unavailable`

## Acceptance Criteria (Issue #13)
1. No protected API/database access occurs before backend token verification and session issuance.
2. `members.line_user_id` and `members.auth_user_id` linkage is enforced for authenticated users.
3. RLS policies use `auth.uid()` lineage rather than `line_user_id` directly.
4. Role resolution is database-driven and deterministic.
5. Authorization denies by default across UI/API/RLS with API+RLS as mandatory controls.
6. Auth and authorization events are logged with sensitive-field masking.

## Related Docs
- `docs/liff-auth-and-role-access.md`
- `docs/user-roles-and-permissions.md`
- `docs/database-erd-and-supabase-schema.md`
