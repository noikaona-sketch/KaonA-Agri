# Production Readiness Review (Issue #59)

Date: 2026-05-07

## Verdict

**Status: Not ready for production release yet.**

The codebase has strong foundational pieces (role-aware app shell, Supabase auth integration, RLS migrations, and core MVP workflows), but there are a few release blockers and pre-launch hardening tasks that should be closed before a production launch.

## What is in good shape

1. **Auth and role foundations are present**
   - LIFF bootstrap and role-based route controls are documented and implemented.
   - Protected route wrappers and auth provider abstraction exist for app-level gating.

2. **Schema + policy baseline exists**
   - Core schema, RLS, and lifecycle constraints are already codified in migrations.
   - Approval/review workflows have explicit RPC and policy-oriented implementation.

3. **MVP features are mapped to docs and code**
   - Major flows (member onboarding, plot registration, inspection tasks, no-burn workflow) exist and are aligned with project docs.

## Release blockers (must-fix before production)

1. **Repository hygiene risk: `node_modules/` appears untracked in working tree**
   - Current git status shows `node_modules/` as untracked, which is a release process risk and can cause accidental massive commits or CI drift.
   - Action: ensure `.gitignore` fully excludes dependency folders and remove transient artifacts from the working tree before release tagging.

2. **Testing/quality gate evidence is not documented for launch**
   - There is no visible release checklist artifact in-repo that confirms lint/build/test/database migration verification for a production candidate.
   - Action: add a repeatable release checklist and require sign-off for each deployment.

3. **Operational readiness docs are thin**
   - Existing docs are strong on architecture and feature scope, but production operations guidance (incident response, rollback, monitoring runbook, on-call triggers) is not yet centralized.
   - Action: create an ops runbook and define SLO/error-budget + escalation paths.

## High-priority hardening (should-fix)

1. **Security hardening checks**
   - Add explicit pre-release verification for RLS policies against each role path using seeded test identities.
   - Add secret/config audit checklist (Supabase keys, LIFF settings, environment separation).

2. **Reliability and observability**
   - Define app + DB monitoring metrics (error rate, auth failures, RPC failures, latency percentiles).
   - Add alert thresholds for critical user journeys: login bootstrap, member approval RPC, inspection evidence upload.

3. **Data lifecycle + compliance controls**
   - Confirm retention/deletion lifecycle for photos, OCR outputs, and approval artifacts.
   - Ensure PII handling and masking checks are validated against role-based views.

## Recommended production gate checklist

Before approving release:

1. Clean working tree and lock dependency state.
2. Run and record lint/typecheck/build.
3. Validate all pending migrations in staging from empty DB and from latest snapshot.
4. Execute role-path smoke tests (farmer, leader, inspector, staff, admin).
5. Verify critical RPC flows (`review_member_onboarding` and status updates).
6. Confirm observability dashboards and alert routes are live.
7. Validate rollback procedure (app + DB) with timed rehearsal.

## Suggested go-live decision

- **Go/No-go recommendation today (2026-05-07): No-go** until blockers above are addressed.
- Once blockers are closed and checklist evidence is attached to the release tag/PR, reassess for go-live.
