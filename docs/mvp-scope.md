# MVP Scope — KaonA Agri

## 1) MVP objective
Define and deliver a first usable product release that enables core agricultural operations to be captured, tracked, and reviewed by authorized users with clear accountability and minimal process overhead.

## 2) MVP / Phase 2 / Phase 3 table

| Area | MVP (Issue #1 scope) | Phase 2 | Phase 3 |
|---|---|---|---|
| Farm setup | Basic farm, field/block, and season setup | Multi-farm hierarchy and templates | Cross-tenant benchmarking and portfolio views |
| Crop planning | Create and manage seasonal crop plans | Scenario planning and what-if comparisons | AI-assisted planning recommendations |
| Activity logging | Record key field activities (e.g., planting, input application, harvest events) | Bulk import and mobile offline capture | Automation integrations from external devices/IoT |
| Input tracking | Track products/inputs used and quantities | Cost allocation by field/activity | Advanced compliance and sustainability scoring |
| Harvest tracking | Capture harvest records by field/date/crop | Quality grading and lot tracking | End-to-end traceability with external partners |
| Reporting | Basic operational dashboards and exports | Configurable KPI dashboards | Predictive analytics and anomaly detection |
| Access control | Role-based access for core internal roles | Fine-grained permissions and audit trails | Delegated admin and policy-based controls |

## 3) In-scope MVP modules
1. **Organization & farm structure**: farm, field/block, and season definitions.
2. **Crop plan management**: create, update, and review seasonal crop plans.
3. **Field activity records**: log core activities with date, field, crop, and notes.
4. **Input usage records**: record input/product usage and quantities per activity.
5. **Harvest records**: capture harvest entries tied to crop and field.
6. **Basic reporting**: summary views and downloadable tabular exports.
7. **User and role access (basic)**: enforce access by defined user roles.

## 4) Out-of-scope items (for MVP)
- Financial accounting, invoicing, and payment workflows.
- Procurement/vendor management workflows.
- Native mobile apps and offline-first synchronization.
- Hardware/IoT integrations.
- Advanced analytics, forecasting, or optimization models.
- Complex workflow engines and approval chains.
- External partner portals (buyers, suppliers, regulators).
- Multi-language localization and enterprise SSO.

## 5) User roles involved
- **Owner/Admin**: manages setup, users, and full operational visibility.
- **Farm Manager**: plans crops, oversees operations, reviews reports.
- **Field Staff/Operator**: records field activities, input usage, and harvest entries.
- **Viewer/Analyst**: read-only access for operational monitoring and reporting.

## 6) Main workflows
1. **Season setup workflow**: create season, define farms/fields/blocks, assign responsible users.
2. **Crop planning workflow**: create and adjust crop plans, then confirm plan for execution.
3. **Execution logging workflow**: record field activities and input usage, then manager review.
4. **Harvest workflow**: record harvest events and review cumulative seasonal output.
5. **Operational review workflow**: review dashboards/reports and export data as needed.

## 7) Screen list
1. Sign in
2. Dashboard (operational summary)
3. Farms & fields management
4. Seasons management
5. Crop plans list/detail
6. Activity log list/create/edit
7. Input usage entry/list
8. Harvest entry/list
9. Reports/export
10. User & role management (basic)

## 8) Data entity list
- User
- Role
- Farm
- Field/Block
- Season
- Crop
- Crop Plan
- Activity Record
- Input/Product
- Input Usage Record
- Harvest Record
- Report Export Job (or equivalent export metadata)

## 9) Acceptance criteria
1. MVP scope boundaries are explicitly documented and distinguish MVP vs later phases.
2. Stakeholders can identify included modules and excluded capabilities without ambiguity.
3. Core roles are defined and mapped to MVP use.
4. End-to-end operational workflows (plan → execute → harvest → review) are documented.
5. Required MVP screens and core data entities are listed and aligned to workflows.
6. This scope document can be used as the baseline for backlog refinement and delivery planning.

## 10) Open questions / assumptions
### Open questions
1. Which reports are mandatory at launch versus optional in MVP?
2. Are there regulatory data fields that must be captured from day one?
3. Is single-organization tenancy sufficient for MVP, or is multi-organization support required?
4. What level of auditability is required for activity and harvest edits?

### Assumptions
1. MVP targets a limited set of internal users before broader rollout.
2. Initial deployment prioritizes web access over native mobile.
3. Data import needs are minimal at launch and can be manual.
4. Advanced integrations and analytics are intentionally deferred to later phases.
