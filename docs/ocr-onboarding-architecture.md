# OCR Onboarding Architecture (Issue #109 Draft)

## Scope
This document is **architecture/spec preparation only** for OCR-assisted member onboarding. It does **not** change production registration runtime behavior.

## Goals
- Compare OCR provider options for Thai citizen ID extraction.
- Define extracted-field draft schema and confidence handling.
- Specify privacy and security boundaries before implementation.
- Prepare environment/config contracts and rollout guardrails.

## Non-Goals (for this issue)
- No changes to live onboarding UI logic.
- No changes to submit validation or RPC behavior.
- No client-side OCR runtime logic.
- No sensitive-image handling implementation.

## Provider comparison (draft)
| Provider | Strengths | Risks/Tradeoffs | Deployment Fit |
|---|---|---|---|
| Cloud Vision OCR | Mature APIs, good docs, broad language support | Data residency/privacy review required, variable Thai ID field quality | Good for POC with strict DPA controls |
| AWS Textract / IDP stack | Strong enterprise controls, IAM integration | Higher integration complexity, cost variability | Good for staged production with security ownership |
| Azure Document Intelligence | Form-like extraction and model tooling | Thai document template tuning may be required | Viable if org already standardized on Azure |
| On-device / self-hosted OCR | Data control, potentially reduced external exposure | Accuracy/ops burden, mobile performance constraints | Long-term option after baseline metrics |

## Recommended architecture direction
1. Keep OCR execution in backend service boundary (never trust client extraction output directly).
2. Store only minimum required extracted data and confidence metadata.
3. Treat OCR output as **draft** pending user confirmation and/or reviewer validation.
4. Persist immutable audit events for extraction + overrides.

## Extracted field draft (Thai citizen ID)
- `citizen_id_masked` (string, required for onboarding payload)
- `citizen_id_hash` (server-side deterministic hash for dedupe/fraud controls)
- `title_th` (optional)
- `first_name_th` (optional)
- `last_name_th` (optional)
- `date_of_birth` (optional, ISO date if confidently parsed)
- `address_text_th` (optional, raw bounded length)
- `confidence_overall` (0..1)
- `confidence_by_field` (JSON object)
- `ocr_provider` / `ocr_model_version`
- `review_status` (`pending`, `accepted`, `manual_review`, `rejected`)

## Data flow (proposed)
1. User captures ID image in onboarding flow (future UX work).
2. Backend uploads image to restricted storage bucket with short retention policy.
3. OCR worker invokes configured provider, returns structured extraction draft.
4. Draft is shown to user for confirmation/edit (future UX).
5. Confirmed fields are submitted through existing onboarding contract (masked ID requirement remains).
6. Reviewer/admin tools can inspect confidence + audit trail when flagged.

## Environment config draft
- `OCR_PROVIDER` (`gcp_vision` | `aws_textract` | `azure_docint` | `disabled`)
- `OCR_PROVIDER_REGION`
- `OCR_MIN_CONFIDENCE` (default draft: `0.85`)
- `OCR_REQUIRE_MANUAL_REVIEW_BELOW` (default draft: `0.70`)
- `OCR_IMAGE_RETENTION_DAYS` (default draft: `30`)
- `OCR_REDACTION_ENABLED` (`true`/`false`, default `true`)
- `OCR_AUDIT_LOG_ENABLED` (`true`/`false`, default `true`)

## Rollout checklist (architecture gate)
- DPIA/privacy sign-off completed.
- Thai legal copy reviewed by compliance.
- Provider DPA and data residency confirmed.
- Security controls validated in staging.
- False-positive/false-negative acceptance thresholds documented.
