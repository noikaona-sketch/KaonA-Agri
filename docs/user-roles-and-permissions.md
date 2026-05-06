# User Roles and Permissions

## Purpose
Define KaonA Agri role definitions and permission principles for product and engineering alignment.

## Role Definitions

### 1) farmer
- Creates and updates their own farm and field activity records.
- Uploads field photos and progress data for assigned farms.
- Can view only records within their permitted scope.

### 2) leader
- Oversees farmer operations across assigned groups/areas.
- Reviews and approves/rejects submitted field records where workflow requires it.
- Can view aggregated reporting for assigned operational scope.

### 3) inspector
- Performs verification and compliance checks on field submissions.
- Can add inspection findings, verification notes, and status outcomes.
- Access is limited to inspection-assigned records and required metadata.

### 4) truck_owner
- Manages transport-related records tied to logistics operations.
- Updates shipment/transport status and required transport documentation.
- Cannot alter unrelated farm governance or user administration settings.

### 5) staff
- Supports internal operations, data updates, and coordination workflows.
- Access is task-scoped and limited to assigned operational functions.
- Cannot grant roles or access beyond delegated authority.

### 6) admin
- Manages users, role assignments, operational settings, and policy controls.
- Can access cross-functional reporting and audit views as authorized.
- Responsible for enforcing access policies and operational guardrails.

### 7) service_account
- Non-human API/system identity for automation and integrations.
- Must be granted explicit least-privilege scopes per integration use case.
- Must be auditable, time-bounded where possible, and revocable.

## Permission Principles
- **Least Privilege:** Grant only the minimum access needed to perform required tasks.
- **Need to Know:** Restrict sensitive data visibility by role and business context.
- **Separation of Duties:** Prevent one role from both initiating and approving high-risk actions when feasible.
- **Explicit Deny by Default:** Access should be denied unless explicitly allowed.
- **Auditability:** Sensitive actions (role change, delete, approval, export) must be loggable.
- **Revocability:** Access must be removable quickly when a user changes role or leaves.
- **Scoped Access:** Permissions should be bounded by tenant/org/project/area where supported.

## Field Data Permission Rules
- Field and photo records must preserve attribution metadata (`created_by`, `role_used`, `timestamp`, `uploaded_by`).
- Verification-related roles (leader/inspector/admin) may review required compliance metadata.
- Citizen ID values must remain masked in normal UI access paths unless explicit privileged authorization exists.

## Permission Model Guidance
- Prefer role-based access control (RBAC) with optional attribute checks for fine-grained constraints.
- Document permissions as action verbs on resources (e.g., `field_record.create`, `photo.upload`, `inspection.verify`).
- Avoid hard-coding role checks throughout UI/business logic; centralize authorization logic.

## Minimum Baseline Matrix (Conceptual)
- **farmer:** create/update own field data; read scoped records.
- **leader:** operational oversight, approvals, and scoped reporting.
- **inspector:** verification workflows and compliance status updates.
- **truck_owner:** logistics/transport record management within scope.
- **staff:** assigned operational support workflows.
- **admin:** administrative control and governance oversight.
- **service_account:** explicit integration scopes only.
