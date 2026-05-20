# Issue #203 Audit — Admin member import and missing-document review workflow

Date: 2026-05-20

## Scope audited
- `/admin/members`
- `/admin/members/[id]`
- member approval/status update flow
- bank account fields/status
- member document fields/status
- missing document indicators
- ready-to-approve indicators
- admin permission checks
- existing import/legacy member logic

## What already exists
- Admin members page has tabs for approvals, list, roles, groups, PIN, and import; import tab currently offers template download and explicitly states no auto-approve.
- Member list page includes status filters and a readiness indicator based on bank verification and plot presence.
- Member detail page supports status actions (approve/return/reject/suspend/reopen), bank verification status updates, completeness checklist, document preview list, and approval history panel.
- Approval API supports status transitions, enforces reason for returned/rejected, has completeness gate on approval with override reason flow, and writes logs to `member_approval_logs`.
- DB layer already has bank verification status (`missing|needs_review|verified|rejected`) and approval log table.
- Existing legacy/admin-created member path exists via PIN flow and nullable `line_user_id` with helper SQL functions.

## What partially exists
- Import workflow is template-download only; UI says preview/import page will come later.
- Approval queue endpoint currently lacks explicit permission-key check (uses `requireAdmin`, not `requireAdminPermission`), while other member APIs are permission-key aware.
- Completeness checklist shows document verification states but does not enforce required document matrix by role.
- Ready-to-approve logic differs by surface:
  - list indicator checks only bank verified + has plot
  - approval gate checks phone/subdistrict/district/province + bank verified
  - checklist includes other fields (address, line_user_id, citizen id, role-specific plot/vehicle)

## What is missing
- Missing-document indicator is present visually only per uploaded doc item; no explicit “required doc missing” detector and no role-based required-doc checklist.
- No centralized, shared readiness policy used by list, detail, and API gate.
- Import execution endpoint (parse/preview/confirm/import/errors) is not implemented yet.
- No explicit permission check for import action (`members.import`) on UI affordance; only template download is admin-gated.

## Security concerns
- `GET /api/admin/members/approvals` currently does not call admin auth at all; pending approvals could be exposed if route is reachable without middleware protection.
- `POST /api/admin/members/approvals` checks only `requireAdmin` and not granular permission (`members.approve`), allowing any authenticated admin account to approve/reject regardless of role permissions.
- Several member APIs mix `requireAdmin` and `requireAdminPermission`, creating inconsistent authorization surface.

## Recommended small PR breakdown
1. **PR-A: Permission hardening for member approval/import endpoints**
   - Add `requireAdminPermission('members.read')` on approvals GET.
   - Add `requireAdminPermission('members.approve')` on approvals POST and bank status mutation.
   - Add `requireAdminPermission('members.import')` on import template + future import endpoints.

2. **PR-B: Centralize readiness/completeness policy (server utility)**
   - Create single rule utility used by list readiness, detail checklist summary, and approval POST gate.
   - Return normalized `missingFields` + `readyToApprove` in detail/list APIs.

3. **PR-C: Missing-document model + indicators (no migration redesign)**
   - Define role-based required-doc map in code.
   - Compute `missingDocuments` from existing `member_documents` rows and show explicit chips/counts in list + detail + queue.

4. **PR-D: Import flow scaffold (no Excel parser yet)**
   - Add placeholder endpoints/contracts for upload->preview->confirm with `members.import` permission and audit logging.
   - Keep actual Excel parsing/import logic out of scope as requested.
