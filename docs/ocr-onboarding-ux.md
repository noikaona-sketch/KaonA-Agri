# OCR Onboarding UX Draft (Mock Specification)

## Scope
Mock UX specification for future implementation of OCR-assisted onboarding.
No production UI/runtime behavior changes are included in this issue.

## UX principles
- OCR is assistive, not authoritative.
- Manual correction is always available.
- Privacy messaging is clear in Thai language.
- Confidence/risk states are visible without exposing sensitive internals.

## Proposed journey (mock)
1. **Step A: Consent & Notice**
   - Explain why ID data is used and retained.
   - Explicit consent checkbox before capture.
2. **Step B: Capture Guidance**
   - On-screen framing tips (lighting, glare, full document in frame).
3. **Step C: Extraction Preview**
   - Show extracted fields with per-field confidence hints.
4. **Step D: User Confirmation**
   - User confirms or edits values.
5. **Step E: Submission Outcome**
   - Status copy: submitted, manual review required, or retry.

## Thai privacy wording draft
> เราใช้ข้อมูลจากบัตรประชาชนเพื่อยืนยันตัวตนในการสมัครสมาชิกเท่านั้น

> ระบบจะบันทึกเฉพาะข้อมูลที่จำเป็น และปกปิดเลขบัตรในหน้าจอทุกครั้ง

> คุณสามารถแก้ไขข้อมูลที่ระบบอ่านได้ก่อนส่งคำขอ

> หากความแม่นยำไม่เพียงพอ ระบบจะขอให้กรอกข้อมูลด้วยตนเองหรือส่งตรวจสอบเพิ่มเติม

## Field-level UX notes
- Citizen ID: display masked format only (e.g., `*********1234`).
- Names: allow Thai text edits and preserve user-corrected values.
- Date of birth: allow manual calendar selection fallback.
- Address: optional confirm/edit with length guardrails.

## Error/recovery states (mock)
- Image unreadable: prompt recapture with guidance.
- Low confidence: route to manual confirmation.
- Provider timeout: safe retry with no duplicate submission.
- Security block: fail closed with support contact path.
