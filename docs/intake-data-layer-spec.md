# Intake Data Layer — ระบบนำเข้าข้อมูลรับซื้อ

## Overview

รับข้อมูลได้ **2 ช่องทาง** ผลลัพธ์เดียวกันคือ `harvest_bookings` ที่มี actual data ครบ

```
ช่อง A: Factory API (อัตโนมัติ)     ช่อง B: Manual Entry (staff กรอก)
    ↓                                      ↓
POST /api/intake/factory              POST /api/intake/manual
    ↓                                      ↓
    ──────────── shared intake service ────────────
                         ↓
              harvest_bookings (actual data)
                         ↓
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
   LINE แจ้ง farmer  รายงาน admin   stock movement
```

---

## Migration ที่ต้องเพิ่ม

```sql
-- 202605230001_harvest_intake_economics.sql

alter table public.harvest_bookings
  -- ช่องทางนำเข้า
  add column if not exists intake_source     text not null default 'manual'
    check (intake_source in ('manual','factory_api','csv_import','pos_scan')),
  add column if not exists intake_source_ref text,   -- เลข transaction จากโรงงาน
  add column if not exists intake_by         uuid references public.members(id),

  -- ผลการชั่ง (แยกจาก actual_received_kg เดิมที่มีอยู่แล้ว)
  add column if not exists gross_weight_kg   numeric(12,2),   -- น้ำหนักรวม (ก่อนหัก)
  add column if not exists deduct_pct        numeric(5,2),    -- % หักน้ำหนัก
  add column if not exists net_weight_kg     numeric(12,2),   -- น้ำหนักสุทธิหลังหัก

  -- ราคาและการชำระ
  add column if not exists price_per_kg      numeric(8,4),    -- ราคา/กก. ที่ใช้จริง
  add column if not exists bonus_per_kg      numeric(8,4) default 0, -- โบนัสโปรโมชั่น
  add column if not exists gross_amount      numeric(14,2),   -- ยอดก่อนหัก
  add column if not exists deduct_amount     numeric(14,2) default 0,
  add column if not exists net_amount        numeric(14,2),   -- ยอดสุทธิที่จ่าย
  add column if not exists payment_method    text
    check (payment_method in ('transfer','cash','credit','debit_account', null)),
  add column if not exists payment_ref       text,            -- เลขโอน/ใบเสร็จ

  -- ข้อมูลเพิ่มเติม
  add column if not exists intake_location_id uuid references public.pickup_locations(id),
  add column if not exists scale_ticket_no   text,           -- เลขใบชั่ง
  add column if not exists quality_grade     text
    check (quality_grade in ('A','B','C','reject', null)),
  add column if not exists rejection_reason  text;

-- API key สำหรับโรงงาน
create table if not exists public.factory_api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,           -- ชื่อระบบโรงงาน เช่น "ScaleSystem-01"
  key_hash    text not null unique,    -- bcrypt hash ของ API key จริง
  location_id uuid references public.pickup_locations(id),
  is_active   boolean not null default true,
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Intake log สำหรับ audit trail
create table if not exists public.intake_logs (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references public.harvest_bookings(id),
  source          text not null,       -- 'factory_api' | 'manual' | 'csv_import'
  raw_payload     jsonb,               -- ข้อมูลดิบที่รับมา (สำหรับ debug)
  processed_at    timestamptz not null default now(),
  processed_by    uuid references public.members(id),
  status          text not null default 'success',
  error_message   text
);
```

---

## API Functions ทั้งหมด

### A. Factory API (ระบบโรงงานเรียกเข้ามา)

```
POST /api/intake/factory
Authorization: Bearer {factory_api_key}
```

**Request body:**
```json
{
  "scale_ticket_no": "TK-2569-00123",
  "transaction_ref": "FAC-001",
  "member_id": "uuid หรือ phone",
  "location_id": "uuid",
  "weigh_at": "2026-05-23T10:30:00+07:00",
  "gross_weight_kg": 5200,
  "moisture_pct": 28.5,
  "quality_grade": "A"
}
```

**Function flow:**
```
1. verify API key (factory_api_keys table)
2. ค้นหา harvest_booking ที่ match member + location + วันที่
3. คำนวณ deduction ตาม moisture_deductions table
4. คำนวณ price จาก market_prices + promotions
5. บันทึก actual data ใน harvest_bookings
6. สร้าง stock_movement (corn_in)
7. บันทึก intake_log
8. ส่ง LINE push แจ้ง farmer
9. return receipt data
```

**Response:**
```json
{
  "ok": true,
  "booking_id": "uuid",
  "net_weight_kg": 4940,
  "net_amount": 22230,
  "receipt_url": "/receipts/TK-2569-00123"
}
```

---

### B. Manual Entry (staff กรอกเอง)

```
POST /api/intake/manual
Authorization: session (staff/admin)
```

**Request body — เหมือน Factory API แต่เพิ่ม:**
```json
{
  "booking_id": "uuid (optional — ถ้าไม่มีใน system)",
  "member_phone": "เผื่อ walk-in ที่ไม่ได้จอง",
  "intake_note": "หมายเหตุเพิ่มเติม",
  ...ข้อมูลชั่งเหมือน factory
}
```

**Function flow:**
```
1. verify staff session
2. ถ้าไม่มี booking_id → สร้าง walk-in booking อัตโนมัติ
3. ค้นหา member จาก phone/id
4. คำนวณ deduction + price เหมือน factory
5. บันทึกข้อมูล (intake_source = 'manual')
6. บันทึก intake_log พร้อม staff_id
7. ส่ง LINE push แจ้ง farmer
8. return receipt
```

---

### C. CSV Import (รับซื้อจากจุดอื่น)

```
POST /api/intake/csv-import
Content-Type: multipart/form-data
```

**CSV format:**
```
scale_ticket_no,member_phone,gross_weight_kg,moisture_pct,weigh_at,location_name
TK-001,0812345678,5200,28.5,2026-05-23 10:30,จุดรับที่ 2
TK-002,0898765432,3800,25.0,2026-05-23 11:00,จุดรับที่ 2
```

**Function flow:**
```
1. parse CSV
2. validate ทุก row (ขาด field / ไม่เจอ member / moisture ผิดช่วง)
3. preview summary ก่อน commit
4. admin ยืนยัน → process batch
5. คำนวณ deduction/price ทุก row
6. บันทึกทีเดียว (transaction)
7. ส่ง LINE push batch
8. export ผลสรุป CSV
```

---

### D. Shared Calculation Engine

```typescript
// src/lib/intake/calculate-intake.ts

function calculateIntake(input: {
  gross_weight_kg: number
  moisture_pct: number
  location_id: string
  weigh_at: Date
  member_id: string
}) → IntakeResult {

  // 1. ดึง deduction จาก moisture_deductions
  const deduction = findNearestDeduction(moisture_pct)
  //    weight_deduct_pct, price_adjust_per_kg

  // 2. คำนวณน้ำหนัก
  const deduct_pct    = deduction.weight_deduct_pct
  const net_weight_kg = gross_weight_kg × (1 - deduct_pct/100)

  // 3. ดึงราคาฐาน
  const base_price = getActiveBasePrice(location_id, weigh_at)

  // 4. บวกราคาตามความชื้น + โปรโมชั่น
  const price_adjust = deduction.price_adjust_per_kg
  const promos       = getActivePromos(member_id, moisture_pct, weigh_at)
  const bonus        = sum(promos.map(p => p.bonus_per_kg))
  const final_price  = base_price + price_adjust + bonus

  // 5. คำนวณยอดเงิน
  const gross_amount  = net_weight_kg × base_price
  const bonus_amount  = net_weight_kg × bonus
  const net_amount    = net_weight_kg × final_price

  return {
    net_weight_kg, deduct_pct, deduct_kg,
    base_price, price_adjust, bonus_per_kg: bonus,
    final_price, gross_amount, bonus_amount, net_amount,
    applied_promos: promos
  }
}
```

---

### E. Receipt & Notification

```
GET /api/intake/receipt/{booking_id}
— farmer, staff, admin ดูได้

POST /api/intake/notify
— internal: ส่ง LINE push เมื่อ intake สำเร็จ
— ข้อความ: น้ำหนัก + ราคา + ยอดเงิน + โบนัส
```

---

## ไฟล์ที่ต้องสร้าง

```
Migration:
  202605230001_harvest_intake_economics.sql

API:
  app/api/intake/factory/route.ts       (factory webhook)
  app/api/intake/manual/route.ts        (staff manual entry)
  app/api/intake/csv-import/route.ts    (batch import)
  app/api/intake/receipt/[id]/route.ts  (ดูใบเสร็จ)

Lib (shared):
  src/lib/intake/calculate-intake.ts    (calculation engine)
  src/lib/intake/find-booking.ts        (match farmer + date + location)
  src/lib/intake/verify-factory-key.ts  (API key auth)
  src/lib/intake/send-receipt.ts        (LINE notification)

UI (staff):
  src/features/staff-intake/
    intake-form.tsx                     (manual entry form)
    intake-csv-preview.tsx              (preview CSV ก่อน import)
    intake-queue-board.tsx             (คิวรอชั่งณ วันนั้น)

UI (admin):
  src/features/admin-reports/
    intake-daily-report.tsx             (ยอดรับซื้อรายวัน)
    expected-vs-actual-report.tsx       (คาดการณ์ vs จริง)
```

---

## ข้อแนะนำเพิ่มเติม

### 1. Idempotency Key
ทุก factory API call ควรส่ง `scale_ticket_no` เป็น unique key
ถ้าโรงงาน retry ส่งซ้ำ → ระบบ ignore ไม่บันทึกซ้ำ

### 2. ข้อมูลจากจุดอื่นที่ไม่มีในระบบ (Walk-in)
```
ถ้า member ไม่ได้จองล่วงหน้า:
  → staff กรอก phone → ระบบ lookup member
  → ถ้าไม่เจอ → สร้าง "guest record" ชั่วคราว
  → admin reconcile ทีหลัง
```

### 3. Quality Grade เชื่อมโบนัส
```
grade A (ความชื้น <22%) → โบนัสตามโปรโมชั่น
grade B (22-28%)         → ราคาปกติ
grade C (>28%)           → หักเพิ่ม
reject                   → ส่งคืน ไม่รับซื้อ
```

### 4. Real-time Dashboard
staff ที่จุดรับเห็น:
- คิวที่จองไว้วันนี้ (booking list)
- โควต้าที่เหลือ (dryer + dry)
- ยอดรับซื้อสะสมวันนี้ real-time
- ⚠️ เมื่อโควต้าเหลือ <20%

### 5. Reconciliation
สิ้นวัน admin กด "ปิดรับวันนี้":
- เปรียบเทียบ booking vs actual รับจริง
- flag booking ที่ไม่มา (no-show)
- export รายงานสรุปวัน
- lock ไม่ให้แก้ไขย้อนหลัง

### 6. Multi-location Aggregation
ถ้ามีจุดรับ 3-4 จุด:
- แต่ละจุดมี `location_id` ของตัวเอง
- factory_api_key ผูกกับ location
- รายงานรวมได้จาก `intake_location_id`
- ไม่ต้องแก้ code เมื่อเพิ่มจุดใหม่

---

*เอกสารนี้เป็น spec สำหรับ PR ถัดไป — ยังไม่มี code*
*อัปเดต: พ.ค. 2569*
