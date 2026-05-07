# App Entry and Role-Based Home Flow (Issue #45 Plan)

## Purpose
Define the **planning blueprint** for app entry states, role-based home behavior, route map, and bottom navigation structure for KaonA Agri.

> This document is scope-limited to planning and UX/architecture alignment only.
> No runtime behavior change, no API implementation, and no database migration are included in this issue.

---

## 1) Required App Entry States

The app entry flow should be centralized in one gate (for example, root route access guard) and route users by resolved auth/member/role state.

1. **Loading session**
   - Meaning: LIFF/Supabase auth state is still being resolved.
   - UX: full-screen loading state with simple Thai-first copy and retry-safe behavior.

2. **No LINE/Supabase session**
   - Meaning: user is not authenticated yet.
   - UX: sign-in required state; LIFF login is the only interactive login path for human users.

3. **Authenticated but no member profile**
   - Meaning: auth exists, but no linked member record is found.
   - UX: route to registration/onboarding flow.

4. **Pending approval**
   - Meaning: member profile exists but is awaiting approval.
   - UX: status page with expected wait and support contact path.

5. **Rejected**
   - Meaning: onboarding/member approval was rejected.
   - UX: clear rejection status and recovery/support instructions.

6. **Suspended**
   - Meaning: member account is suspended.
   - UX: blocked access state and support escalation path.

7. **Approved member**
   - Meaning: user is approved and can enter role-based home.
   - UX: route to role-appropriate home and tabs.

8. **Admin/Staff**
   - Meaning: approved role is `admin` or `staff`.
   - UX: operational/admin module entry points.

9. **Inspector**
   - Meaning: approved role is `inspector`.
   - UX: inspection-focused tasks and records entry points.

10. **Truck owner**
    - Meaning: approved role is `truck_owner`.
    - UX: transport/no-burn participation workflows and related records.

---

## 2) Role-Based Home Behavior Plan

### farmer
- Primary focus: field execution and production records.
- Home should prioritize:
  - current cycle/work status,
  - quick actions for plot/cycle updates,
  - no-burn participation status when applicable.

### leader
- Primary focus: oversight within assigned scope.
- Home should prioritize:
  - team/group progress snapshots,
  - pending coordination tasks,
  - quick navigation to farmer-related records.

### staff/admin
- Primary focus: operational control and approvals.
- Home should prioritize:
  - member/admin task queues,
  - no-burn admin workflows,
  - policy-critical actions surfaced first.

### inspector
- Primary focus: verification/compliance workflow.
- Home should prioritize:
  - assigned inspection tasks,
  - pending verification outcomes,
  - quick submission/update actions.

### truck_owner
- Primary focus: logistics contribution and transport-related records.
- Home should prioritize:
  - active transport/no-burn tasks,
  - status updates,
  - relevant record history.

---

## 3) Route Plan (MVP Navigation Map)

- `/` — app entry gate + role-based home destination
- `/register` — member registration onboarding
- `/plots` — plot records list/scope view
- `/plots/new` — create plot flow
- `/cycles` — planting cycle list/create/manage
- `/no-burn` — no-burn participation and workflow actions
- `/admin/members` — member approval/admin operations (admin/staff)
- `/admin/no-burn` — no-burn administration queue/actions (admin/staff)
- `/inspection/tasks` — assigned inspection task list/detail actions
- `/profile` — personal/member profile and account state

---

## 4) Bottom Navigation Plan (4 Tabs)

Use a consistent 4-tab bottom navigation shell across authenticated app surfaces:

1. **Home**
   - Role-specific landing summaries and top-priority actions.

2. **Tasks**
   - Assigned/pending actions by role (approvals, inspections, workflow tasks).

3. **Records**
   - Data entry/history modules (plots, cycles, no-burn records, scoped lists).

4. **Profile**
   - Account/member details, approval status, role display, and support links.

Role visibility and tab destination details should be driven by centralized role-access config, not ad hoc checks in many files.

---

## 5) UI and Architecture Notes

- **Mobile-first:** screens and interactions optimized for LINE in-app webview dimensions.
- **Large buttons:** tap targets must be large enough for field usage contexts.
- **Shared UI components:** reuse shared shell/cards/states/forms for consistency and maintainability.
- **Thai-first wording:** default UX copy should prioritize Thai language clarity.
- **Avoid hardcoding role/status across files:** centralize role/state mapping in a single access utility/config layer.

---

## 6) Explicit Out-of-Scope for Issue #45

- No API route implementation.
- No database migration/schema change.
- No new business logic enforcement.
- No full truck booking flow implementation.
- No dashboard analytics implementation.

