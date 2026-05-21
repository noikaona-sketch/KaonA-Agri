# [FEATURE] Admin member import execution (phase 2)

**Labels:** `feature` `admin` `import` `phase-2`
**Depends on:** #203 completion
**Priority:** P1

## Goal

Implement a safe admin member import flow after Issue #203 completion.

## Must be split into small PRs

1. import scaffold
2. parser preview only
3. confirm import execution
4. repair/missing-data review

## Rules

- [ ] no auto approve
- [ ] no auth redesign
- [ ] no RLS redesign
- [ ] no large migration
- [ ] keep legacy member compatibility
- [ ] nullable `line_user_id` supported
- [ ] dry-run preview before import
- [ ] audit logging required
- [ ] rollback-safe import

## Acceptance Criteria

- [ ] Import flow starts from an admin-only scaffold with no behavior regression.
- [ ] Parser can generate a dry-run preview without writing data.
- [ ] Final execution requires explicit confirm step after preview.
- [ ] Missing/invalid data paths are reviewable and repairable.
- [ ] Import operation emits auditable records for each run.
- [ ] Import can be rolled back safely on partial failures.
- [ ] Legacy members and nullable `line_user_id` records remain compatible.
