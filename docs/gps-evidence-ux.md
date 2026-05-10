# GPS Evidence UX Spec (Issue #110 Preparation)

## Scope
UX preparation only. No production behavior changes are included in Issue #110.

## UX Objectives
- Make GPS capture explicit and understandable.
- Reduce failed submissions by clarifying required steps.
- Communicate confidence/quality without exposing sensitive internals.

## User Journey (Draft)
1. User selects/captures photo evidence.
2. User taps “Capture GPS”.
3. System requests location permission (foreground only).
4. UI displays capture result:
   - Coordinates (rounded for display)
   - Accuracy band
   - Capture time
5. User submits evidence.
6. Submission status shown (submitted / needs review).

## States & Messaging
- **Idle**: “GPS not captured yet.”
- **Capturing**: progress state with cancel/retry guidance.
- **Captured**: show timestamp + accuracy summary.
- **Failed**: actionable error (permission denied, timeout, unavailable).
- **Submitted**: confirmation + next step.

## Error Handling (Draft)
- Permission denied → explain why GPS is requested and how to retry.
- Timeout/unavailable → suggest moving outdoors / retrying.
- Stale location → prompt recapture before submission (future policy gate).

## Accessibility & Localization
- All status messages translatable (EN/TH).
- Buttons and states must be screen-reader friendly.
- Avoid color-only status signals.

## Privacy UX Requirements
- Explicit purpose statement before permission prompt.
- Link to retention/usage notice.
- No hidden/background location collection.

## Acceptance Criteria for Future Build
- User can clearly complete photo + GPS capture flow with <= 1 retry in common conditions.
- Failure messages map to concrete recovery actions.
- Consent text is present before any location request.
