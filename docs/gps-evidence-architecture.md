# GPS Evidence Architecture (Issue #110 Preparation)

## Scope
This document is **architecture/spec preparation only** for GPS evidence in KaonA Agri.

- No production code changes.
- No migrations.
- No schema-dependent insert changes.
- No auth/RLS/map/background-tracking changes.

## Goals
- Define a safe, incremental architecture for GPS evidence capture and validation.
- Identify data boundaries and review gates before implementation.
- Prevent runtime risk from unapproved schema coupling.

## Non-Goals (for #110)
- Persisting new GPS metadata fields in production.
- Enforcing new upload constraints in production UI.
- Device fingerprinting or extended telemetry collection.

## Proposed Layered Design (Future Implementation)
1. **Capture Layer (Client)**
   - Triggered by explicit user action (no background tracking).
   - Collect minimum viable GPS fields required by policy.
   - Surface quality indicators (accuracy/time freshness) in UI.

2. **Validation Layer (Application Service)**
   - Validate payload shape and completeness.
   - Evaluate policy checks (e.g., freshness, accuracy threshold).
   - Assign review status (auto-pass vs manual review path).

3. **Storage Layer (Data Model)**
   - Store only fields approved by privacy + legal review.
   - Version schema contract to avoid brittle client-server coupling.
   - Keep optional fields nullable and feature-flagged.

4. **Review Layer (Ops/Inspection)**
   - Expose auditable evidence summary.
   - Provide reviewer reason-codes for rejects/escalations.
   - Log reviewer actions for traceability.

## Architecture Constraints
- **Schema-first rollout**: no client writes to columns before migration + compatibility guard.
- **Feature flags**: new GPS evidence behaviors gated per environment.
- **Backward compatibility**: existing upload flows must keep functioning with legacy columns.
- **Observability**: add metrics for GPS capture success/failure and validation outcomes before policy hard-enforcement.

## Data Contract Planning (Draft)
Future contract should define:
- Required: latitude, longitude, accuracy, captured timestamp.
- Optional (pending review): provider class, device integrity signals.
- Forbidden without approval: high-risk identifiers and persistent device fingerprint data.

## Rollout Plan (Proposed)
1. Finalize UX + consent language.
2. Security/privacy review sign-off.
3. Schema proposal and migration review.
4. Staging-only integration behind flag.
5. Pilot + monitoring.
6. Controlled production rollout.

## Risks & Mitigations
- **Risk**: schema drift breaks uploads.
  - **Mitigation**: compatibility checks + staged rollout.
- **Risk**: privacy over-collection.
  - **Mitigation**: data minimization checklist + retention policy.
- **Risk**: GPS spoofing.
  - **Mitigation**: policy-driven review workflow; no single-signal trust.
