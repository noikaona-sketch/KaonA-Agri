# MVP Scope — KaonA Agri LINE Mini App

## 1) MVP objective
Deliver a usable LINE Mini App MVP for KaonA Agri that enables member onboarding, plot and planting registration, seed booking, no-burn evidence submission, and inspection/status tracking across farmer, staff/admin, leader, truck_owner, and inspector roles.

## 2) MVP / Phase 2 / Phase 3 table

| Area | MVP (Issue #1 scope) | Phase 2 | Phase 3 |
|---|---|---|---|
| Identity & access | LINE LIFF sign in, role-based access, basic onboarding | Enhanced account recovery and delegated role admin | Cross-organization role federation and SSO extensions |
| Member lifecycle | Member registration, citizen ID OCR + manual fallback, approval workflow | Bulk/member import and profile enrichment | Advanced KYC risk scoring and automation |
| Land & season operations | Plot registration with GPS, planting cycle records | Geofence validation and batch plot tools | Satellite/map intelligence integration |
| Seed workflow | Seed booking request + review + status tracking | Partial fulfillment and schedule coordination | Full supply chain integration |
| No-burn compliance | No-burn registration with photo/GPS evidence | Rule-configurable compliance checks | Automated policy routing and escalations |
| Inspection operations | Inspector tasking, visit submission, result status | SLA tracking and workload balancing | Predictive inspection prioritization |
| Notifications & status | In-app status updates for key flows | Multi-channel notifications (SMS/email) | Personalized proactive recommendations |

## 3) In-scope MVP modules
1. **LINE LIFF login**.
2. **Farmer registration**.
3. **Citizen ID capture via OCR with manual fallback**.
4. **Member approval workflow (staff/admin)**.
5. **Plot registration with GPS coordinates**.
6. **Planting cycle creation and updates**.
7. **Seed booking request and review flow**.
8. **Field photo upload with GPS metadata**.
9. **Inspection workflow (assignment, visit, result submission)**.
10. **No-burn registration and evidence submission**.
11. **Status tracking in LINE Mini App across member requests**.

## 4) Out-of-scope items (for MVP)
- Full POS capability.
- Stock management.
- Finance/accounting modules.
- Full truck booking operations.
- Dashboard analytics.
- AI image analysis.
- IoT integrations.
- Offline-first synchronization.

## 5) User roles involved
- **farmer**: registers as member, manages plot/cycle data, submits bookings and no-burn requests, checks status.
- **leader**: supports member verification/coordination at community level and monitors local request progress.
- **inspector**: receives inspection assignments, visits plots, submits inspection outcomes.
- **truck_owner**: visibility into relevant booking/operation status where assigned (without full booking operations in MVP).
- **staff**: reviews registrations/bookings/requests and processes approvals.
- **admin**: manages approvals, oversight, and role-governed operational control.

## 6) Main workflows
1. **LINE login → register member → staff/admin approval**.
2. **Register plot → create planting cycle → upload field photos**.
3. **Seed booking → staff/admin review → booking status**.
4. **No-burn registration → photo/GPS evidence → inspection**.
5. **Inspector receives job → visits plot → submits inspection result**.
6. **Farmer checks status in LINE Mini App**.

## 7) Screen list
1. LIFF sign in / onboarding
2. Role-based home
3. Member registration
4. Member profile/status
5. Plot list/detail
6. Planting cycle detail
7. Seed booking
8. No-burn registration
9. Inspection task list
10. Inspection form
11. Photo upload
12. Admin approval queue

## 8) Data entity list
- member
- member_role
- plot
- planting_cycle
- seed_order
- no_burn_request
- inspection
- photo
- approval
- notification

## 9) Acceptance criteria
1. Scope explicitly maps MVP to KaonA Agri **LINE Mini App** workflows and excludes non-MVP capabilities.
2. MVP modules include all required registration, approval, GPS/photo evidence, inspection, and status-tracking capabilities.
3. Role definitions are limited to: farmer, leader, inspector, truck_owner, staff, admin.
4. Workflow definitions exactly cover the six required end-to-end operational flows.
5. Screen list and data entities align with defined workflows/modules.
6. Generic farm SaaS constructs outside this scope are excluded from the MVP definition.

## 10) Open questions / assumptions
### Open questions
1. What minimum OCR accuracy threshold is acceptable before mandatory manual fallback?
2. Which member fields are required for approval versus optional for later completion?
3. What GPS precision tolerance is acceptable for plot registration and photo evidence?
4. Should leader role approvals be advisory only, or can they gate staff/admin decisions?
5. What notification timing/SLA is expected for approval and inspection updates in LINE?

### Assumptions
1. LINE account is the primary identity entry point for all MVP users.
2. Staff/admin are the final approvers for membership and request decisions in MVP.
3. Inspector assignment and result submission are managed within the app (no external system dependency).
4. Truck_owner role visibility is limited in MVP and does not require full truck booking features.
