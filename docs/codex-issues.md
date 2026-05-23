# KaonA-Agri — Codex Issues (Updated)

> **Stack:** Next.js 14 · Supabase · TypeScript · LINE LIFF
> **Repo:** noikaona-sketch/KaonA-Agri
> **Rules:** page ≤150 / component ≤200 / API route ≤80 lines
> `npx tsc --noEmit` + `npx next build` must pass before every commit
> Commit format: `feat(ZX-Y): description`

---

## สถานะ (อัปเดต พ.ค. 2569)

| Zone | Issue | Claude ทำแล้ว | Codex ทำ |
|---|---|---|---|
| Z1 Member | Z1-1 LINE approve/reject | ❌ | ✅ ทำ |
| Z1 Member | Z1-2 UAT script | ❌ | ✅ ทำ |
| Z1 Member | Z1-3 RLS verify | ✅ doc แล้ว | — |
| Z1 Member | Z1-4 Admin manual | ❌ | ✅ ทำ |
| Z2 Booking | Z2-1 Staff actual weight | ✅ Z3-5 แล้ว | — |
| Z2 Booking | Z2-2 Admin complete booking | ❌ | ✅ ทำ |
| Z2 Booking | Z2-3 Expected vs actual | ✅ แล้ว | — |
| Z2 Booking | Z2-4 UAT booking | ❌ | ✅ ทำ |
| Z3 Intake | Z3-1 ถึง Z3-5, Z3-7 ถึง Z3-10 | ✅ แล้ว | — |
| Z3 Intake | Z3-6 CSV import | ❌ | ✅ ทำ |
| Z4 Staff | Z4-3 ถึง Z4-6 | ✅ แล้ว | — |
| Z5 No-burn | Z5-1, Z5-3 | ✅ แล้ว | — |
| Z7 Comms | Z7-2, Z7-3 | ✅ แล้ว | — |
| Z8 Reports | Z8-1,2,4,5 | ✅ แล้ว | — |
| Z9 UAT | Z9-1,2,3,6 | ❌ | ✅ ทำ |

---

## 🔴 PRIORITY 1 — Pilot Blockers

---

### Issue Z1-1 · LINE push เมื่อ admin approve/reject สมาชิก

**Labels:** `feature` `line` `pilot-blocker`
**Difficulty:** Easy — pattern มีอยู่แล้ว

**File to modify:** `app/api/admin/members/approvals/route.ts`

**Context:**
ไฟล์มี approval flow อยู่แล้ว หลังจาก `s.from('members').update(updatePayload)` สำเร็จ
ให้เพิ่ม LINE push ก่อน `return NextResponse.json({ ok: true })`

Templates พร้อมใช้ที่: `src/lib/line/push-message.ts`
- `memberApprovedMessage(memberName)`
- `memberRejectedMessage(memberName, reason?)`

**Implementation:**
```typescript
// หลัง member update สำเร็จ — ดึง line_uid + ส่ง push
const { data: memberData } = await s
  .from('members')
  .select('full_name, line_uid')
  .eq('id', body.memberId)
  .maybeSingle();

if (memberData?.line_uid) {
  const msg = body.decision === 'approved'
    ? memberApprovedMessage(memberData.full_name ?? 'คุณ')
    : body.decision === 'rejected'
    ? memberRejectedMessage(memberData.full_name ?? 'คุณ', body.reason)
    : null;
  if (msg) void sendLineMessage(memberData.line_uid, [msg]);
}
```

**Import เพิ่ม:**
```typescript
import { sendLineMessage, memberApprovedMessage, memberRejectedMessage } from '@/lib/line/push-message';
```

**Acceptance criteria:**
- Admin approve → farmer ได้รับ LINE ✅
- Admin reject → farmer ได้รับ LINE ❌ พร้อมเหตุผล
- LINE fail → approval ยังสำเร็จ (fail silently)
- `tsc --noEmit` pass · `next build` pass

---

### Issue Z2-2 · Admin complete harvest booking + บันทึก actual data

**Labels:** `feature` `admin` `pilot-blocker`
**Difficulty:** Medium

**File to modify:** `src/features/admin-harvest/harvest-complete-form.tsx`

**Context:**
ไฟล์นี้มีอยู่แล้ว แต่ยังไม่มี fields: actual_received_kg, actual_moisture_pct, quality_grade, scale_ticket_no

Migration ที่เพิ่ม columns เหล่านี้: `202605230001_harvest_intake_economics.sql` (ทำแล้ว)

**Fields to add to existing form:**
```typescript
// เพิ่มใน form state
actual_received_kg : ''  // number input
actual_moisture_pct: ''  // number input  
quality_grade      : 'B' // select: A|B|C|reject
scale_ticket_no    : ''  // text input (optional)
```

**API call — เพิ่มใน PATCH payload:**
```typescript
{
  status:              'completed',
  actual_completed_at: new Date().toISOString(),
  actual_received_kg:  Number(form.actual_received_kg),
  actual_moisture_pct: Number(form.actual_moisture_pct),
  quality_grade:       form.quality_grade,
  scale_ticket_no:     form.scale_ticket_no || undefined,
}
```

**Acceptance criteria:**
- Admin กรอก actual_received_kg + moisture → booking status = completed
- ข้อมูลแสดงใน report 🎯 คาด vs จริง (`/admin/reports` tab accuracy)
- Component ≤200 lines

---

### Issue Z3-6 · CSV import: batch intake from remote locations

**Labels:** `feature` `admin` `pilot-blocker`
**Difficulty:** Hard

**New files:**
- `app/api/intake/csv-import/route.ts` (≤80 lines)
- `src/features/staff-intake/intake-csv-preview.tsx` (≤200 lines)
- Add tab to `app/harvest/intake/page.tsx`

**CSV format (เหมือนใน docs/intake-data-layer-spec.md):**
```
scale_ticket_no,member_phone,gross_weight_kg,moisture_pct,weigh_at,location_name,quality_grade
TK-001,0812345678,5200,28.5,2026-05-23 10:30,จุดรับที่ 2,B
TK-002,0898765432,3800,25.0,2026-05-23 11:00,จุดรับที่ 2,A
```

**Two-step flow:**
```
POST /api/intake/csv-import?action=preview
  → parse CSV → validate → return { valid: Row[], errors: ErrorRow[] }

POST /api/intake/csv-import?action=commit
  → process valid rows → calculateIntake() → บันทึก → LINE push batch
```

**Shared functions ใช้ได้เลย:**
- `calculateIntake()` — `src/lib/intake/calculate-intake.ts`
- `resolveMemberId()` — `src/lib/intake/find-booking.ts`
- `findOrCreateBooking()` — `src/lib/intake/find-booking.ts`
- `sendIntakeReceipt()` — `src/lib/intake/send-intake-receipt.ts`

**Preview UI shows:**
- ✅ Valid rows: จำนวน + ตัวอย่าง
- ❌ Error rows: เหตุผล (member not found, duplicate ticket, invalid moisture)
- Summary: X valid, Y errors
- Confirm button → commit

**Error types to validate:**
```typescript
type ErrorRow = {
  row: number
  scale_ticket_no: string
  reason: 'member_not_found' | 'duplicate_ticket' | 'invalid_moisture' | 'missing_field' | 'location_not_found'
  detail: string
}
```

**Acceptance criteria:**
- Upload CSV → preview → admin ยืนยัน → batch บันทึก
- Duplicate `scale_ticket_no` ถูก detect ก่อน commit
- LINE push ทุก farmer หลัง commit (async, fail silently)
- `tsc --noEmit` pass · `next build` pass

---

## 🟡 PRIORITY 2 — Quality & Testing

---

### Issue Z2-4 · UAT test script: harvest booking flow

**Labels:** `docs` `testing`
**Output file:** `docs/uat-booking-flow.md`

**Script format (step-by-step):**
```markdown
## การทดสอบ: farmer จอง → แก้ไข → cancel → staff กรอก actual

### Setup
- Farmer A: สมาชิก approved พร้อม planting_cycle
- Admin: account ที่มีสิทธิ์ service.write
- Staff: account ที่มีสิทธิ์ service.write

### Test T1: Farmer จองวันเกี่ยว
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Farmer เปิด /harvest/book | เห็น form จองพร้อมคิวอบ | ⬜ |
| 1.2 | เลือก cycle + วันที่ | dryer queue แสดง utilization | ⬜ |
| 1.3 | กด แจ้งวันเก็บเกี่ยว | success message | ⬜ |
| 1.4 | Admin เปิด harvest queue | เห็น booking ใหม่ | ⬜ |

### Test T2: Farmer แก้ไข booking
...

### Test T3: Staff กรอก actual weight
...
```

**ต้องครอบคลุม:**
1. Farmer จองวันเกี่ยว
2. Admin เห็น queue + peak-day alert
3. Farmer แก้ไข booking (วันที่)
4. Farmer cancel booking
5. Staff กรอก actual weight ที่ `/harvest/intake`
6. Farmer ได้รับ LINE receipt
7. รายงาน 🎯 คาด vs จริง แสดงข้อมูล

---

### Issue Z1-2 · UAT test script: member registration flow

**Labels:** `docs` `testing`
**Output file:** `docs/uat-member-flow.md`

**ครอบคลุม:**
1. Farmer เปิด LINE → แตะ KaonA mini app
2. กรอกข้อมูลสมัครสมาชิก
3. Admin เห็น pending member
4. Admin approve → Farmer ได้รับ LINE ✅
5. Admin reject → Farmer ได้รับ LINE ❌
6. Farmer ผ่าน onboarding checklist (4 ขั้น)
7. CSV import: upload CSV → review → approve batch

---

### Issue Z1-4 · Admin manual

**Labels:** `docs`
**Output file:** `docs/admin-manual.md`

**Sections ที่ต้องมี:**

```markdown
# คู่มือ Admin KaonA-Agri

## 1. การจัดการสมาชิก
### approve/reject สมาชิก
### import CSV สมาชิก

## 2. ตั้งราคารับซื้อ
### ตั้งราคาฐาน (market_prices)
### ตั้งตารางส่วนลดตามความชื้น (moisture_deductions)
### สร้างโปรโมชั่น (campaign_announcements)

## 3. จัดการโควต้าและคิวรับซื้อ
### ตั้ง template รายวัน (intake_quota_templates)
### สร้าง pickup slot จาก template
### ดู utilization realtime

## 4. Factory API Keys
### สร้าง API key สำหรับเครื่องชั่ง
### ปิดใช้งาน key

## 5. ปิดรับวัน (Reconciliation)
### ขั้นตอนปิดรับ
### export CSV วันนั้น

## 6. รายงาน
### รายงานสมาชิก
### รายงานการจองขาย
### คาด vs จริง
### ตามรถ / ตามพื้นที่
```

---

## 🟢 PRIORITY 3 — UAT & Go-Live

---

### Issue Z9-1 · UAT script: farmer full flow

**Labels:** `docs` `testing`
**Output file:** `docs/uat-farmer-flow.md`

**Scenario:** farmer ใช้ระบบครบวงจรตั้งแต่สมัครจนถึงได้ใบเสร็จ

**ครอบคลุม:**
1. สมัครสมาชิก → รอ approve → ได้รับ LINE
2. กรอก onboarding (profile, plot, cycle)
3. ดู moisture calculator + practical suggestion
4. แจ้งวันเกี่ยว → เห็นคิวอบ
5. รับ LINE receipt หลังรับซื้อ
6. ดูรายงานส่วนตัว (กำไร/ต้นทุน/ไม่เผา)
7. ยื่นคำขอไม่เผา → รับ LINE แจ้งผล

---

### Issue Z9-2 · UAT script: staff intake flow

**Labels:** `docs` `testing`
**Output file:** `docs/uat-staff-flow.md`

**Scenario:** staff ทำงานรับซื้อตั้งแต่เปิดวันจนปิดวัน

**ครอบคลุม:**
1. เปิดแอป → เห็น StaffHome พร้อมเมนู ⚖️ บันทึกรับซื้อ
2. เปิดหน้า intake → เห็นคิวรับวันนี้ + quota bar
3. กรอก actual weight + moisture (walk-in ไม่มี booking)
4. กรอก actual weight + moisture (มี booking)
5. Preview ก่อนบันทึก → ยืนยัน
6. Farmer ได้รับ LINE receipt
7. Admin ปิดรับวัน → export CSV

---

### Issue Z9-3 · UAT script: admin management flow

**Labels:** `docs` `testing`
**Output file:** `docs/uat-admin-flow.md`

**Scenario:** admin ทำงานบริหารจัดการระบบทั้งวัน

**ครอบคลุม:**
1. เปิด admin dashboard
2. Approve สมาชิก → ตรวจว่า LINE ส่ง
3. ตั้งราคาฐาน + ส่วนลดความชื้น
4. สร้าง pickup slot จาก template
5. ดู harvest queue + peak-day alert
6. Assign inspector → ตรวจว่า LINE ส่ง
7. Review no-burn → approve → ตรวจว่า LINE ส่ง
8. ดูรายงาน 7 tabs ครบ
9. ปิดรับวัน → export CSV

---

### Issue Z9-6 · Complete launch checklist

**Labels:** `docs` `pilot-blocker`
**File:** `docs/launch-checklist.md`

**ดูไฟล์ที่มีอยู่ อ่านทุก item และเพิ่ม:**
- status: ✅ done | ❌ not done | ⏳ in progress
- วันที่ verify
- ชื่อผู้ verify

**Critical items ที่ต้องมี:**
```markdown
## Pre-Pilot Checklist

### Infrastructure
- [ ] LINE_CHANNEL_ACCESS_TOKEN ตั้งใน Vercel
- [ ] Migrations ทั้งหมด run บน production
- [ ] LIFF ทดสอบบนโทรศัพท์จริง (iOS + Android)
- [ ] RLS ทดสอบกับ user จริง (ดู docs/rls-verification.md)

### Functional
- [ ] สมัครสมาชิก → approve → LINE แจ้ง ✅
- [ ] Farmer จองขาย → staff กรอก actual → LINE receipt ✅
- [ ] No-burn ยื่น → admin approve → LINE แจ้ง ✅
- [ ] Admin ดูรายงานครบทุก tab ✅

### Data
- [ ] ราคาฐานตั้งไว้แล้ว (market_prices)
- [ ] ตารางส่วนลดตั้งไว้แล้ว (moisture_deductions)
- [ ] Pickup slots สร้างแล้ว (อย่างน้อย 7 วัน)
- [ ] Factory API key สร้างแล้ว (ถ้ามีเครื่องชั่ง)

### Safety
- [ ] Backup ล่าสุด
- [ ] Rollback SOP อ่านเข้าใจ
```

---

## สรุปสำหรับ Codex

| Priority | Issue | ประเภท | ยาก |
|---|---|---|---|
| 🔴 | Z1-1 LINE push approve/reject | code | ง่าย |
| 🔴 | Z2-2 Admin complete booking | code | กลาง |
| 🔴 | Z3-6 CSV import batch | code | ยาก |
| 🟡 | Z2-4 UAT booking script | docs | ง่าย |
| 🟡 | Z1-2 UAT member script | docs | ง่าย |
| 🟡 | Z1-4 Admin manual | docs | ง่าย |
| 🟢 | Z9-1 UAT farmer flow | docs | ง่าย |
| 🟢 | Z9-2 UAT staff flow | docs | ง่าย |
| 🟢 | Z9-3 UAT admin flow | docs | ง่าย |
| 🟢 | Z9-6 Launch checklist | docs | ง่าย |

**Code issues: 3 ตัว · Docs issues: 7 ตัว · รวม 10 issues**

---

## กฎสำหรับ Codex ทุก issue

1. อ่านไฟล์ที่เกี่ยวข้องก่อนเขียน
2. page ≤150 / component ≤200 / API route ≤80 lines
3. `npx tsc --noEmit` → 0 errors
4. `npx next build` → must pass
5. Commit: `feat(ZX-Y): description`
6. ห้ามแก้ไขไฟล์ที่ไม่เกี่ยวกับ issue นั้น
