# User Roles and Permissions

## Purpose
Define baseline role definitions and permission principles for product and engineering alignment.

## Role Definitions

### 1) Platform Owner
- Full administrative access across organization settings and business data.
- Can manage billing, integrations, environments, and user role assignments.
- Can view audit history and export governance reports.

### 2) Organization Admin
- Administrative access within a specific organization/workspace.
- Can invite/remove users, assign project-level roles, and manage org settings.
- Cannot change platform-wide billing or super-admin controls.

### 3) Manager
- Can create and manage operational entities (teams, projects, workflows, assignments).
- Can approve/reject workflows and view team-level reporting.
- Cannot manage organization security/billing settings.

### 4) Contributor
- Can create and edit records they own or are assigned to.
- Can collaborate on shared tasks and update workflow states as allowed.
- Cannot manage user roles or restricted settings.

### 5) Viewer
- Read-only access to permitted data and dashboards.
- Cannot create, edit, delete, or approve operational records.

### 6) Service Account (Non-Human)
- API/system role for automation with least-privilege scoped access.
- Permissions must be explicitly granted per integration use case.
- Must be auditable and revocable.

## Permission Principles
- **Least Privilege:** Grant only the minimum access needed to perform required tasks.
- **Need to Know:** Restrict sensitive data visibility by role and business context.
- **Separation of Duties:** Prevent one role from both initiating and approving high-risk actions when feasible.
- **Explicit Deny by Default:** Access should be denied unless explicitly allowed.
- **Auditability:** Sensitive actions (role change, delete, approval, export) must be loggable.
- **Revocability:** Access must be removable quickly when a user changes role or leaves.
- **Scoped Access:** Permissions should be bounded by tenant/org/project where supported.

## Permission Model Guidance
- Prefer **role-based access control (RBAC)** with optional attribute checks for fine-grained constraints.
- Document permissions as action verbs on resources (e.g., `project.read`, `task.update`, `user.invite`).
- Avoid hard-coding role checks throughout UI/business logic; centralize authorization logic.

## Minimum Baseline Matrix (Conceptual)
- **Platform Owner:** full read/write/admin across all resources.
- **Organization Admin:** admin on org-scoped resources, no platform super-admin.
- **Manager:** read/write on team/project operations + approval capabilities.
- **Contributor:** read/write limited to assigned/owned operations.
- **Viewer:** read-only.
- **Service Account:** explicitly scoped integration permissions only.
