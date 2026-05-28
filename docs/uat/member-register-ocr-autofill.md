# UAT: Member Registration OCR Autofill (Thai ID)

Scope: farmer member registration OCR autofill behavior.

## Preconditions
- Open member registration (farmer flow).
- OCR endpoint `/api/ocr/id-card` is reachable.
- Use camera capture from the OCR step.

## Case 1: Valid Thai full name autofills fullName
1. Scan an ID image where OCR returns a valid Thai `fullName`.
2. Leave `fullName` empty before scan.
3. Confirm `fullName` is auto-filled.

Expected:
- `fullName` is populated from OCR.

## Case 2: bankAccountName default logic
1. Keep `bankAccountName` empty before scan.
2. Scan an ID image where OCR returns:
   - `bankAccountName` valid Thai name -> should use this value.
3. Reset and scan an ID image where OCR returns:
   - empty/invalid `bankAccountName`
   - valid Thai `fullName`

Expected:
- When OCR `bankAccountName` is valid, `bankAccountName` uses OCR `bankAccountName`.
- Otherwise `bankAccountName` falls back to parsed OCR `fullName`.

## Case 3: Existing user-entered fields are not overwritten
1. Manually enter `fullName`, `citizenId`, `address`, `houseNo`, `moo`, `subdistrict`, `district`, `province`, `bankAccountName`.
2. Scan an ID image with different OCR values.

Expected:
- Existing non-empty fields remain unchanged.

## Case 4: Invalid/non-Thai fullName does not fill bankAccountName fallback
1. Keep `bankAccountName` empty.
2. Scan an ID image where OCR `fullName` is invalid or non-Thai.
3. OCR `bankAccountName` is also empty/invalid.

Expected:
- `bankAccountName` remains empty (no fallback from invalid/non-Thai `fullName`).

## Error handling check
1. Simulate OCR failure (endpoint returns non-200 or no extracted payload).

Expected:
- User sees friendly message only:
  `ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง`
- User can continue manual input and submit normally.
