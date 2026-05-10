# Security & Privacy Checklist: GPS Evidence (Issue #110 Preparation)

## Scope Gate
This checklist is for design-time approval before implementation.

- [ ] No production upload behavior changed under Issue #110.
- [ ] No migrations or schema-dependent inserts under Issue #110.

## Data Minimization
- [ ] Required fields are explicitly justified.
- [ ] Optional fields have documented purpose and owner.
- [ ] High-risk metadata is excluded until approved.

## Consent & Transparency
- [ ] User-facing purpose statement drafted.
- [ ] Consent/notice copy reviewed by product/legal.
- [ ] Retention window defined and communicated.

## Security Controls
- [ ] Input validation rules documented.
- [ ] Abuse/spoofing review path defined.
- [ ] Audit logging requirements documented.
- [ ] Access control requirements mapped to roles.

## Reliability & Rollout
- [ ] Backward compatibility plan documented.
- [ ] Feature flag rollout plan documented.
- [ ] Monitoring metrics defined (capture failures, validation outcomes).
- [ ] Incident rollback path defined.

## Compliance Review
- [ ] Privacy review sign-off.
- [ ] Security review sign-off.
- [ ] Data governance sign-off.
