# KaonA-Agri — Master Plan

**สถานะ:** MVP ใกล้พร้อม Pilot ✅ | ยังไม่พร้อม Rollout ❌
**เป้าหมาย Pilot:** 20–50 สมาชิก · 1–2 ทีม · โรงงาน KaonA
**อัปเดต:** พ.ค. 2569

---

## ภาพรวมระบบและความพร้อม

| # | ระบบ | ความพร้อม | Pilot blocking? |
|---|---|---|---|
| 1 | ระบบสมาชิก | 75% | ✅ ต้องจบ |
| 2 | ระบบแปลงและการปลูก | 65% | บางส่วน |
| 3 | ระบบรับซื้อ | 70% | ✅ ต้องจบ |
| 4 | ระบบ Intake Data Layer | 10% | ✅ ต้องจบ |
| 5 | ระบบเมล็ด/ร้านค้า | 80% | — |
| 6 | ระบบไม่เผา | 55% | — |
| 7 | ระบบตรวจแปลง | 45% | — |
| 8 | ระบบเจ้าหน้าที่ | 35% | ✅ ต้องจบ |
| 9 | ระบบรถร่วม | 30% | — |
| 10 | ระบบสื่อสาร | 50% | LINE token |
| 11 | ระบบรายงาน | 40% | บางส่วน |
| 12 | ระบบตัดสินใจเกี่ยว | 90% | — |

---

## เส้นทางสู่ Pilot

```
Zone 0 Fix  →  Zone 1 Member  →  Zone 2 Booking + Zone 4 Intake  →  Zone 7 UAT
                                                                            ↓
                                                                    Pilot 20–50 คน
```

## เส้นทางสู่ Full Rollout

```
Zone 3 No-burn  →  Zone 5 Weather  →  Zone 6 Reports  →  Zone 4 Inspection
     ↓                                                            ↓
Zone 8 Staff workflow                                      Full Rollout
```

---

# ZONE 0 — Fix ก่อน Pilot

> **ต้องทำก่อนทุกอย่าง** — ถ้าข้ามจะทำให้ Pilot ล้มเหลว

## งานที่ต้องทำ

| # | งาน | เหตุผล | เวลา |
|---|---|---|---|
| Z0-1 | ทดสอบ LIFF login บนโทรศัพท์จริง ทุก role | LIFF ≠ browser | 2–3 ชม. |
| Z0-2 | Run migrations 82 ตัวบน Supabase production | ยังไม่ confirmed | 1 ชม. |
| Z0-3 | ตั้ง LINE Channel Access Token ใน Vercel | LINE push ส่งไม่ได้ | 30 นาที |
| Z0-4 | ทดสอบ RLS กับ user จริง 3 role | มี policy แต่ยังไม่ verify | 2 ชม. |
| Z0-5 | เขียน Backup & Rollback SOP 1 หน้า | ถ้าพัง ไม่รู้ทำอะไร | 30 นาที |

**Done เมื่อ:** Login ได้ + approve สมาชิกได้ + จองขายได้ + LINE แจ้งได้

---

# ZONE 1 — ระบบสมาชิก (75% → 90%)

> **เป้า:** สมัคร → approve → onboarding ครบวงจร

## ฟังก์ชันที่มีแล้ว
- สมัครสมาชิกผ่าน LINE LIFF
- Admin approve / reject
- Import CSV + review
- Onboarding checklist (4 ขั้น)
- กลุ่มสมาชิก (member_groups)

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z1-1 | LINE แจ้งผล approve/reject | ใช้ push-message.ts ที่มีแล้ว + เพิ่มใน approvals route | ง่าย |
| Z1-2 | UAT: สมัคร → approve → login | ทำ test script + checklist | ง่าย |
| Z1-3 | Verify RLS: member เห็นเฉพาะตัวเอง | test ด้วย user จริง 2 account | กลาง |
| Z1-4 | คู่มือ admin 1 หน้า | markdown + screenshot | ง่าย |

**Done เมื่อ:** สมาชิก 5 คนสมัครผ่าน LINE → admin approve → ได้ LINE แจ้ง → login ได้

---

# ZONE 2 — ระบบรับซื้อ (70% → 90%)

> **เป้า:** จองขาย → admin จัดคิว → รับจริง → บันทึกน้ำหนักจริง

## ฟังก์ชันที่มีแล้ว
- Farmer จองวันเกี่ยว + เลือกจุดรับ
- Admin queue + daily load + peak-day alert
- Dryer quota per location + intake template
- Farmer เห็นคิวอบ 7 วัน (harvest-timing-panel)
- Moisture calculator + practical suggestion

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z2-1 | Staff UI: บันทึก actual weight + moisture | `staff-intake/intake-form.tsx` | กลาง |
| Z2-2 | Admin: complete booking + actual data | แก้ admin harvest queue | กลาง |
| Z2-3 | Expected vs actual report เบื้องต้น | `admin-reports/expected-vs-actual.tsx` | กลาง |
| Z2-4 | UAT: จอง → แก้ไข → cancel | test script | ง่าย |

**Done เมื่อ:** farmer จอง → admin เห็น queue → staff กรอก actual → report แสดงผล

---

# ZONE 3 — Intake Data Layer (10% → 80%)

> **แกนกลางของระบบรับซื้อ** — รับข้อมูลได้ 3 ช่องทาง ผลลัพธ์เดียวกัน

## สถาปัตยกรรม

```
ช่อง A: Factory API          ช่อง B: Staff Manual        ช่อง C: CSV Import
    ↓                              ↓                            ↓
POST /api/intake/factory    POST /api/intake/manual    POST /api/intake/csv
    ↓                              ↓                            ↓
    ──────────── calculateIntake() shared engine ────────────────
                                   ↓
                    harvest_bookings (actual data)
                                   ↓
              LINE แจ้ง farmer · รายงาน · stock movement
```

## Migration ที่ต้องเพิ่ม

```sql
-- 202605230001_harvest_intake_economics.sql

alter table public.harvest_bookings
  -- ช่องทางนำเข้า
  add column if not exists intake_source      text not null default 'manual'
    check (intake_source in ('manual','factory_api','csv_import','pos_scan')),
  add column if not exists intake_source_ref  text,        -- เลข transaction จากโรงงาน
  add column if not exists intake_by          uuid references public.members(id),
  add column if not exists intake_location_id uuid references public.pickup_locations(id),

  -- ผลการชั่ง
  add column if not exists gross_weight_kg    numeric(12,2), -- น้ำหนักรวมก่อนหัก
  add column if not exists deduct_pct         numeric(5,2),  -- % หักน้ำหนัก
  add column if not exists net_weight_kg      numeric(12,2), -- น้ำหนักสุทธิหลังหัก
  add column if not exists scale_ticket_no    text,          -- เลขใบชั่ง (idempotency key)

  -- ราคาและการชำระ
  add column if not exists price_per_kg       numeric(8,4),
  add column if not exists bonus_per_kg       numeric(8,4) default 0,
  add column if not exists gross_amount       numeric(14,2),
  add column if not exists deduct_amount      numeric(14,2) default 0,
  add column if not exists net_amount         numeric(14,2),
  add column if not exists payment_method     text
    check (payment_method in ('transfer','cash','credit','debit_account', null)),
  add column if not exists payment_ref        text,

  -- คุณภาพ
  add column if not exists quality_grade      text
    check (quality_grade in ('A','B','C','reject', null)),
  add column if not exists rejection_reason   text;

-- API keys สำหรับโรงงาน
create table if not exists public.factory_api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,          -- ชื่อระบบ เช่น "ScaleSystem-01"
  key_hash     text not null unique,   -- hash ของ API key จริง
  location_id  uuid references public.pickup_locations(id),
  is_active    boolean not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Audit log ทุก intake
create table if not exists public.intake_logs (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.harvest_bookings(id),
  source        text not null,
  raw_payload   jsonb,
  processed_at  timestamptz not null default now(),
  processed_by  uuid references public.members(id),
  status        text not null default 'success',
  error_message text
);
```

## Shared Calculation Engine

```typescript
// src/lib/intake/calculate-intake.ts
// Pure function — ใช้ร่วมทั้ง 3 ช่องทาง ทดสอบได้ง่าย

function calculateIntake(input: {
  gross_weight_kg : number
  moisture_pct    : number
  member_id       : string
  location_id     : string
  weigh_at        : Date
}): IntakeResult {

  // 1. หาส่วนลดตามความชื้น (moisture_deductions)
  const deduction      = findNearestDeduction(moisture_pct)
  const deduct_pct     = deduction.weight_deduct_pct
  const net_weight_kg  = gross_weight_kg * (1 - deduct_pct / 100)

  // 2. ราคาฐาน (market_prices ณ วันชั่ง)
  const base_price     = getActiveBasePrice(location_id, weigh_at)

  // 3. บวกราคาตามความชื้น + โปรโมชั่น
  const price_adjust   = deduction.price_adjust_per_kg
  const promos         = getActivePromos(member_id, moisture_pct, weigh_at)
  const bonus          = promos.reduce((s, p) => s + p.bonus_per_kg, 0)
  const final_price    = base_price + price_adjust + bonus

  // 4. ยอดเงิน
  const gross_amount   = net_weight_kg * base_price
  const bonus_amount   = net_weight_kg * bonus
  const net_amount     = net_weight_kg * final_price

  return {
    net_weight_kg, deduct_pct,
    base_price, price_adjust, bonus_per_kg: bonus, final_price,
    gross_amount, bonus_amount, net_amount,
    applied_promos: promos
  }
}
```

## API Functions

### A. Factory API — โรงงานส่งข้อมูลเข้าอัตโนมัติ

```
POST /api/intake/factory
Authorization: Bearer {factory_api_key}

Request:
{
  scale_ticket_no : "TK-2569-00123",  // idempotency key
  member_id       : "uuid หรือ phone",
  location_id     : "uuid",
  weigh_at        : "2026-05-23T10:30:00+07:00",
  gross_weight_kg : 5200,
  moisture_pct    : 28.5,
  quality_grade   : "A"
}

Flow:
1. verify API key → หา location
2. ค้นหา booking ที่ match member + location + วัน
3. ถ้าไม่เจอ → สร้าง walk-in booking
4. calculateIntake()
5. บันทึก actual data ใน harvest_bookings
6. สร้าง stock_movement (corn_in)
7. บันทึก intake_log
8. LINE push แจ้ง farmer
9. return receipt

Response:
{
  ok            : true,
  booking_id    : "uuid",
  net_weight_kg : 4940,
  net_amount    : 22230,
  applied_promos: [...]
}
```

### B. Manual Entry — Staff กรอกเอง ณ จุดรับ

```
POST /api/intake/manual
Authorization: staff session

Request: เหมือน Factory + เพิ่ม
{
  booking_id   : "uuid (optional)",
  member_phone : "กรณี walk-in ไม่มี booking",
  intake_note  : "หมายเหตุ"
}

Flow:
1. verify staff session
2. ถ้าไม่มี booking_id → ค้นหา member จาก phone
   ถ้าไม่เจอ member → สร้าง guest record
3. calculateIntake()
4. บันทึก (intake_source = 'manual', intake_by = staff_id)
5. intake_log + LINE push + return receipt
```

### C. CSV Import — รับซื้อจากจุดอื่น / batch

```
POST /api/intake/csv-import
Content-Type: multipart/form-data

CSV format:
scale_ticket_no, member_phone, gross_weight_kg, moisture_pct, weigh_at, location_name

Flow:
1. parse + validate ทุก row
2. return preview: valid X rows, errors Y rows
3. admin ยืนยัน → process batch (DB transaction)
4. calculateIntake() ทุก row
5. LINE push batch
6. export ผลสรุป CSV
```

### D. Receipt

```
GET /api/intake/receipt/{booking_id}
— farmer, staff, admin ดูได้

แสดง:
- น้ำหนักรวม → หัก % → น้ำหนักสุทธิ
- ราคาฐาน + บวกตามความชื้น + โบนัส → ราคาจริง
- ยอดเงินสุทธิ
- รายชื่อโปรโมชั่นที่ได้รับ
- เลขใบชั่ง + วันเวลา + จุดรับ
```

## เงื่อนไขธุรกิจ

| เงื่อนไข | Logic |
|---|---|
| **Idempotency** | `scale_ticket_no` unique per location — ส่งซ้ำ → ignore ไม่บันทึกซ้ำ |
| **Walk-in** | ไม่มี booking → สร้างอัตโนมัติ → admin reconcile ทีหลัง |
| **Quality Grade** | A (<22%) → โบนัสเต็ม · B (22-28%) → ปกติ · C (>28%) → หักเพิ่ม · reject → ส่งคืน |
| **Quota check** | ก่อนรับ → ตรวจ capacity_kg_dryer / capacity_kg_dry ใน pickup_slots |
| **End-of-day** | admin ปิดรับ → compare booking vs actual → flag no-show → lock |
| **Multi-location** | factory_api_key ผูกกับ location_id → เพิ่มจุดใหม่ไม่ต้องแก้ code |

## งานที่ต้องทำ

| # | งาน | ไฟล์ | ยาก |
|---|---|---|---|
| Z3-1 | Migration economics fields | `202605230001_harvest_intake_economics.sql` | ง่าย |
| Z3-2 | Calculation engine | `src/lib/intake/calculate-intake.ts` | กลาง |
| Z3-3 | Helper: find-booking, verify-key, send-receipt | `src/lib/intake/*.ts` | กลาง |
| Z3-4 | Factory API endpoint | `app/api/intake/factory/route.ts` | กลาง |
| Z3-5 | Manual entry API + UI | `app/api/intake/manual/` + `staff-intake/intake-form.tsx` | กลาง |
| Z3-6 | CSV import API + preview UI | `app/api/intake/csv-import/` + `intake-csv-preview.tsx` | ยาก |
| Z3-7 | Receipt page | `app/api/intake/receipt/[id]/` | ง่าย |
| Z3-8 | Staff queue board (real-time) | `staff-intake/intake-queue-board.tsx` | กลาง |
| Z3-9 | End-of-day reconciliation | `admin/harvest/reconcile/page.tsx` | ยาก |
| Z3-10 | Admin: manage factory API keys | `admin/harvest/api-keys/page.tsx` | ง่าย |

**Done เมื่อ:** staff กรอก actual weight → คำนวณถูก → LINE แจ้ง farmer → รายงานแสดงผล

---

# ZONE 4 — ระบบเจ้าหน้าที่ (35% → 75%)

> **เป้า:** staff มี workflow ชัดเจนตั้งแต่เปิดจนปิดวัน

## ฟังก์ชันที่มีแล้ว
- StaffHome + เมนูพื้นฐาน
- จองเมล็ดให้สมาชิก
- ดู field map + กลุ่มสมาชิก
- ดู dryer queue 7 วัน

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z4-1 | Staff intake form (actual weight) | ใช้จาก Zone 3 | — |
| Z4-2 | Staff queue board วันนี้ | ใช้จาก Zone 3 | — |
| Z4-3 | Leader: ดูสมาชิกในกลุ่ม + สถานะ | แก้ leader view ใน page.tsx | ง่าย |
| Z4-4 | Inspector: ดู task list + กรอกผล | inspect task มีแล้ว แต่ assign ยังไม่มี | กลาง |
| Z4-5 | Admin assign inspection ให้ inspector | `admin/inspections/assign/` | กลาง |
| Z4-6 | LINE แจ้ง inspector งานใหม่ | เพิ่มใน assign flow | ง่าย |

**Done เมื่อ:** staff เปิดแอป → เห็นคิวรับวันนี้ → กรอก actual weight → ปิดวันได้

---

# ZONE 5 — ระบบไม่เผา (55% → 80%)

> **เป้า:** ยื่นคำขอ → GPS/รูป → approve → โบนัสคำนวณถูก

## ฟังก์ชันที่มีแล้ว
- Farmer ยื่นคำขอ + อัปโหลดรูป + GPS
- Admin GPS evidence review (map)
- Admin approve/reject
- โบนัสในรายงาน farmer

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z5-1 | LINE แจ้งผล approve/reject | เพิ่มใน no-burn approvals route | ง่าย |
| Z5-2 | Test GPS จริงใน LINE webview | ทดสอบภาคสนาม | กลาง |
| Z5-3 | เชื่อมกับ inspection (ถ้า admin สั่งตรวจ) | เพิ่ม flow trigger inspection | ยาก |
| Z5-4 | UAT: farmer ส่งรูป GPS จริง → approve | test script + checklist | ง่าย |

**Done เมื่อ:** farmer 3 คนทดสอบจริง → approve → LINE แจ้ง → โบนัสถูก

---

# ZONE 6 — ระบบตรวจแปลง (45% → 70%)

> **เป้า:** assign งาน → ตรวจ → บันทึกผล → เชื่อมกับ no-burn

## ฟังก์ชันที่มีแล้ว
- Inspector เห็น task list
- กรอกผลตรวจ + อัปโหลดรูป
- Admin GPS review

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z6-1 | Admin assign UI | `admin/inspections/assign/page.tsx` | กลาง |
| Z6-2 | Inspector รับ LINE แจ้งงานใหม่ | เพิ่มใน assign flow | ง่าย |
| Z6-3 | ผลตรวจเชื่อมกับ no-burn approval | trigger ใน inspection complete | ยาก |
| Z6-4 | ผลตรวจเชื่อมกับ planting_cycles | บันทึกผลใน cycle | กลาง |

**Done เมื่อ:** admin assign → inspector ได้ LINE → บันทึกผล → admin เห็น

---

# ZONE 7 — ระบบสื่อสาร (50% → 80%)

> **เป้า:** LINE push ทำงานจริง + broadcast ตามกลุ่มได้

## ฟังก์ชันที่มีแล้ว
- Campaign announcements
- In-app notifications
- Surveys + responses
- Alerts (admin)
- โปรโมชั่นสมาชิก

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z7-1 | ตั้ง LINE token + ทดสอบ push จริง | Vercel env + test | ง่าย |
| Z7-2 | Broadcast ตามกลุ่ม/พื้นที่ | แก้ campaign form + batch push | กลาง |
| Z7-3 | Push template สำเร็จรูป | approve / reject / intake receipt / quota alert | ง่าย |

**Done เมื่อ:** admin ส่งข้อความ → สมาชิกได้รับใน LINE จริง

---

# ZONE 8 — ระบบรายงาน (40% → 70%)

> **เป้า:** admin ดูรายงานหลักได้ทุกวันโดยไม่ต้องเข้า Supabase

## ฟังก์ชันที่มีแล้ว
- ยอดขายตามสินค้า (7/30/90 วัน)
- สต็อกสินค้า + utilization
- รายงานตามพื้นที่ (อำเภอ/ตำบล/กลุ่ม)
- Farmer self-report (กำไร/ต้นทุน/ไม่เผา)

## งานที่ต้องทำ

| # | งาน | สิ่งที่ต้องสร้าง | ยาก |
|---|---|---|---|
| Z8-1 | รายงานสมาชิก (approved/pending/rejected) | `admin-reports/member-summary.tsx` | ง่าย |
| Z8-2 | รายงานการจองขาย รายวัน/สัปดาห์ | `admin-reports/booking-report.tsx` | ง่าย |
| Z8-3 | Expected vs Actual น้ำหนัก/ความชื้น | `admin-reports/expected-vs-actual.tsx` | กลาง |
| Z8-4 | รายงานตามรถ/คนขนส่ง | `admin-reports/by-vehicle-report.tsx` | กลาง |
| Z8-5 | Export CSV (member list, booking list) | เพิ่มปุ่ม export ใน reports | กลาง |
| Z8-6 | Intake daily report (ยอดรับซื้อรายวัน) | ใช้จาก Zone 3 | — |

**Done เมื่อ:** admin ดูรายงาน 6 ตัวได้ + export ได้

---

# ZONE 9 — UAT & Go-Live

> **ทำหลัง Zone 0-3 เสร็จ**

## งานที่ต้องทำ

| # | งาน | รายละเอียด |
|---|---|---|
| Z9-1 | UAT Script: farmer role | สมัคร → จองขาย → แจ้งวันเกี่ยว → ดูรายงาน |
| Z9-2 | UAT Script: staff role | กรอก actual weight → ดูคิว → ปิดวัน |
| Z9-3 | UAT Script: admin role | approve member → ดู queue → รายงาน |
| Z9-4 | RLS verification | user จริง 2 account ไม่เห็นข้อมูลกัน |
| Z9-5 | คู่มือ admin 1 หน้า | approve / intake / quota / รายงาน |
| Z9-6 | Tick `docs/launch-checklist.md` | ทุก checkbox ต้อง ✅ |
| Z9-7 | Soft launch 5–10 คน | เก็บ feedback 1 สัปดาห์ |
| Z9-8 | Pilot 20–50 คน | เปิดรอบใหญ่ |

---

# สิ่งที่ตัดออกจาก MVP (Phase 2)

| รายการ | เหตุผล |
|---|---|
| OCR บัตรประชาชนจริง | ต้องการ Document AI key + setup |
| ระบบเกรดสมาชิก Bronze/Silver/Gold | ต้องข้อมูลสะสม |
| Learning loop (actual vs คาดการณ์) | ต้องข้อมูล 2+ ฤดูกาล |
| Offline fallback | complexity สูง |
| Sentry error monitoring | nice-to-have |
| ระบบรถร่วมเต็มรูปแบบ | ต้องออกแบบใหม่ทั้งหมด |
| Broadcast ตามพิกัด GPS | ต้องการ geofencing |

---

*เอกสารนี้รวม completion-roadmap.md + intake-data-layer-spec.md*
*อัปเดต: พ.ค. 2569*
