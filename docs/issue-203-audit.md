# Issue #203 Security Audit Follow-up (Docs-Only)

## Context
This PR is intentionally **docs-only** to track the permission-hardening recommendations and rollout notes after the #288 hotfix rebase.

## Audit Findings Summary
The audit highlighted permission boundary gaps around admin member workflows:

1. Approval queue read access (`GET /api/admin/members/approvals`) should be protected by a granular read permission.
2. Approval mutation access (`POST /api/admin/members/approvals`) should require an approval-scoped permission rather than broad admin presence.
3. Bank verification mutation paths must remain behind the same approval-scoped permission.
4. Member import template/future import surfaces should be protected by an import-scoped permission.

## Scope Guardrails
No implementation changes are included in this PR. Specifically:

- No runtime code changes
- No auth redesign
- No RLS changes
- No database migrations
- No UI redesign
- No business logic changes

## Rebase Note
This branch was updated/rebased to include the latest mainline hotfix context associated with #288 before proceeding.

## Verification Checklist
- [x] Docs-only diff
- [x] No changes under `app/`
- [x] No auth/RLS/migration changes
- [x] Ready for Vercel validation

## Vercel Readiness
Because this PR is docs-only and contains no runtime changes, it is expected to be **Vercel Ready** with no deployment behavior impact.
