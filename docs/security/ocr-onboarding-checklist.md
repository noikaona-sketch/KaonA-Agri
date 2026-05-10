# Security Checklist: OCR Onboarding (Draft)

## Objective
Define mandatory controls before enabling OCR in member onboarding.

## Data protection
- [ ] Enforce TLS in transit and encryption at rest for all OCR artifacts.
- [ ] Restrict raw ID image access to least-privilege service roles.
- [ ] Apply retention/deletion policy for raw and processed images.
- [ ] Store masked ID in app-visible records; keep full ID out of logs/UI.
- [ ] Use deterministic hashing strategy for dedupe checks (server-side only).

## Access control and auditing
- [ ] RLS/ACL policies reviewed for OCR result tables and storage paths.
- [ ] Admin/reviewer access requires role-based authorization.
- [ ] All OCR reads/writes/reviews captured in immutable audit logs.
- [ ] Incident response runbook includes OCR data exposure scenarios.

## Provider and compliance
- [ ] DPA signed with OCR provider.
- [ ] Data residency and subprocessor list approved.
- [ ] Thai PDPA/legal review completed for onboarding copy and retention.
- [ ] Vendor security posture reviewed (SOC2/ISO or equivalent).

## Application security
- [ ] Validate MIME type, file signature, and max size server-side.
- [ ] Malware scanning / content safety checks on uploaded files.
- [ ] No client-trusted OCR output for final identity assertions.
- [ ] Confidence thresholds enforced server-side.
- [ ] Rate limits and abuse detection configured on OCR endpoints.

## Release gates
- [ ] Threat model reviewed and signed off.
- [ ] Pen-test or focused security testing completed.
- [ ] Staging verification for retention jobs and audit logs.
- [ ] Rollback plan documented before production enablement.
