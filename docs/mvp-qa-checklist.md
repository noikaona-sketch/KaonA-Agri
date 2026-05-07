# MVP QA Checklist

This checklist is the release-readiness gate for the KaonA Agri LINE Mini App MVP.

## 1) Test Setup & Environment

- [ ] Test with at least 5 user personas: `farmer`, `staff`, `admin`, `leader`, `inspector` (and `truck_owner` visibility checks if seeded).
- [ ] Validate in mobile viewport first (LINE in-app browser behavior), then desktop browser sanity check.
- [ ] Verify all required seed data exists (members, plots, planting cycles, tasks, approvals).
- [ ] Confirm Supabase connectivity and expected RLS behavior for each role.
- [ ] Confirm LIFF app initialization works in QA environment (app boot, profile fetch, route protection).
- [ ] Capture test evidence format (screenshots + timestamp + role + expected/actual result).

## 2) Authentication & Session

- [ ] LIFF sign-in is the only interactive sign-in path for MVP users.
- [ ] Unauthenticated users are redirected to sign-in/entry flow.
- [ ] Session survives page refresh and route navigation.
- [ ] Session expiration or invalid token produces clear re-auth flow.
- [ ] Role resolution is deterministic when multiple roles exist.
- [ ] Role-based landing page/home route is correct per user role.

## 3) Authorization & Role Access

- [ ] Each role only sees allowed routes/pages.
- [ ] Forbidden pages/components are blocked server-side and client-side.
- [ ] Navigation menu/tabs are role-aware and hide unauthorized entries.
- [ ] Direct URL access to restricted pages is blocked with safe fallback.
- [ ] Data queries return only allowed records for each role.
- [ ] Write operations are denied for unauthorized roles (negative tests).

## 4) Member Registration Flow (MVP)

- [ ] New member form loads with correct required fields.
- [ ] Validation messages appear for missing/invalid input.
- [ ] Submit creates member in expected status (e.g., pending).
- [ ] Duplicate prevention behavior is correct (e.g., LINE ID / key identifiers).
- [ ] Staff/admin can review and approve/reject as defined.
- [ ] Status transition history/audit timestamps are captured.
- [ ] Approved member appears in downstream flows that depend on active membership.

## 5) Plot Registration & Geolocation

- [ ] Plot form loads and supports required geographic fields.
- [ ] GPS capture works (lat/lng persisted correctly).
- [ ] Manual coordinate entry validation works (range/format).
- [ ] Plot ownership/member association is correct.
- [ ] Plot status transitions are recorded and visible to authorized users.
- [ ] Plot list/detail views show newly registered records with correct metadata.

## 6) Planting Cycle & Field Operations

- [ ] Planting cycle creation flow works end-to-end.
- [ ] Date and season fields enforce validation/business rules.
- [ ] Linked member/plot references are consistent.
- [ ] Editing/updating cycle state preserves data integrity.
- [ ] Status chips/labels reflect backend source of truth.

## 7) Seed Booking / Request Flow

- [ ] Eligible users can create booking/request with required fields.
- [ ] Quantity and constraints validation is enforced.
- [ ] Staff/admin approval workflow functions as expected.
- [ ] Rejection path requires/records reason (if defined in workflow).
- [ ] Request status updates are visible to requester and approvers.
- [ ] truck_owner visibility (if in MVP scope for assigned operations) is correct.

## 8) No-Burn Evidence Submission

- [ ] Evidence submission UI supports photo checklist requirements.
- [ ] Image upload success/failure states are clear.
- [ ] Geolocation capture confirmation is shown and persisted.
- [ ] Evidence can be linked to correct member/plot/cycle context.
- [ ] Inspectors/staff can review submitted evidence.
- [ ] Evidence records retain timestamp, actor, and status trail.

## 9) Inspection Tasks & Status Tracking

- [ ] Inspection task list loads for authorized roles.
- [ ] Task detail includes required context and evidence linkages.
- [ ] Inspector can update task outcomes/status.
- [ ] Status progression follows allowed transitions only.
- [ ] Farmer/leader/staff views reflect updated status consistently.
- [ ] Any SLA/priority indicator appears correctly if implemented.

## 10) UI/UX & Navigation Quality

- [ ] Primary navigation follows role-aware MVP map.
- [ ] Back/forward behavior is predictable in LINE in-app browser.
- [ ] Forms are mobile-usable (touch targets, keyboard types, spacing).
- [ ] Loading/empty/error states exist for every critical list/detail view.
- [ ] CTA labels and status chips are clear and consistent.
- [ ] Thai/English copy (if bilingual) is consistent and non-truncated.

## 11) Data Integrity & Auditability

- [ ] Created/updated timestamps populate correctly.
- [ ] `created_by` / `updated_by` (or equivalent actor fields) are captured where required.
- [ ] Cross-entity references (member ↔ plot ↔ cycle ↔ task) remain valid.
- [ ] Soft-delete/archival behavior (if present) is respected by UI queries.
- [ ] No orphaned records are created during happy or failure paths.

## 12) Error Handling & Resilience

- [ ] Network/API failures show actionable user feedback.
- [ ] Retry paths are available where sensible.
- [ ] Invalid server responses are handled gracefully.
- [ ] Unauthorized/forbidden responses trigger correct UX fallback.
- [ ] Form submit double-click protection prevents duplicate records.

## 13) Performance & Reliability (MVP Baseline)

- [ ] App entry/home route loads within acceptable mobile performance budget.
- [ ] Critical pages remain responsive on low-end mobile devices.
- [ ] Large list views paginate/limit safely (no major UI freezes).
- [ ] Image uploads complete within acceptable QA threshold.

## 14) Security & Privacy Baseline

- [ ] No sensitive tokens/secrets exposed in client logs or UI.
- [ ] PII visibility is role-appropriate.
- [ ] Supabase RLS policies enforce read/write boundaries in real queries.
- [ ] File upload access rules prevent unauthorized retrieval.

## 15) Regression Smoke (Pre-Release)

Run this full smoke for each deploy candidate:

- [ ] Login → role home → logout/login cycle.
- [ ] Member registration create + approval.
- [ ] Plot registration with geolocation.
- [ ] Planting cycle create/update.
- [ ] Seed request create + approve/reject.
- [ ] No-burn evidence submit + review.
- [ ] Inspection task update + downstream status visibility.

## 16) Release Exit Criteria

- [ ] All P0/P1 MVP scenarios pass.
- [ ] No open critical or high-severity defects.
- [ ] Known issues are documented with owner + target fix date.
- [ ] Product + engineering sign-off completed.
- [ ] QA evidence package archived (screenshots, logs, checklist revision).

---

## Suggested Defect Severity Guide

- **P0/Critical**: Security/data loss/system unusable.
- **P1/High**: Core MVP flow broken; no viable workaround.
- **P2/Medium**: Partial workaround exists; non-core impact.
- **P3/Low**: Cosmetic/minor UX issue.
