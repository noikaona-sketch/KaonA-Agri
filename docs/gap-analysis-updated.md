# KaonA-Agri Gap Analysis — Updated (มิถุนายน 2569)

> อัปเดตจาก Production Readiness doc เดิม + สิ่งที่พัฒนาเพิ่มใน session ล่าสุด

---

## Overall Progress

| เดิม | ปัจจุบัน |
|---|---|
| ~80% | **~92%** |

ระบบหลักครบแล้ว รวม Service Provider Platform, No-burn Season, Soil Inspection  
เหลือเฉพาะ P1 ที่ต้องทำก่อน Go-live จริง

---

## P1 — Critical Before Go Live

---

### 1. OCR Production Readiness

**สถานะ: 🟡 Partial**

| ส่วน | สถานะ |
|---|---|
| OCR confidence score | ✅ มีแล้ว (`confidenceOrBlank()` threshold 0.7/0.85) |
| Parser tuning | ✅ มีแล้ว (Thai name, citizen ID, address) |
| OCR audit log | ✅ บันทึกใน `ocr_results` table |
| Manual review screen | ⚠️ มี UI review แต่ยังไม่มี "correction workflow" เต็มรูปแบบ |
| Thai name inconsistency | ⚠️ ยังมีบ้าง — ขึ้นกับ card quality |

**แนะนำ:** เพิ่ม "flag for manual review" เมื่อ confidence < threshold แทน blank  
**Priority:** ✅ ยอมรับได้สำหรับ Pilot (admin review ทุก case อยู่แล้ว)

---

### 2. Farmer 360 View

**สถานะ: 🟡 Partial**

| ส่วน | สถานะ |
|---|---|
| Member info + bank + documents | ✅ `AdminMemberDetail` (panels) |
| Plot management | ✅ มีใน panels |
| Approvals history | ✅ `approval-history-panel.tsx` |
| Planting cycles | ⚠️ แยกอยู่ใน `/admin/farming` — ยังไม่รวมใน member detail |
| Seed reservations | ⚠️ แยกอยู่ใน `/admin/seeds` |
| Harvest transactions | ⚠️ แยกอยู่ใน `/admin/harvest` |
| No-burn participation | ⚠️ แยกอยู่ใน `/admin/no-burn` |
| Inspection records | ⚠️ แยกอยู่ใน `/admin/inspections` |

**Gap:** ยังไม่มี single view ที่รวมทุก section  
**แนะนำ:** เพิ่ม tabs ใน `AdminMemberDetail` — Planting / Harvest / No-burn / Inspection  
**Priority:** 🔴 ควรทำก่อน Go-live (ช่วย support + field ops มาก)  
**ขนาดงาน:** กลาง (1-2 วัน) — ดึง data เพิ่ม ไม่ต้องสร้าง API ใหม่

---

### 3. End-to-End Traceability

**สถานะ: 🟡 Partial — Data มีครบ แต่ไม่มี unified view**

| ส่วน | สถานะ |
|---|---|
| Seed Sale → Planting | ✅ `planting_cycle_id` อยู่ใน seed_reservations |
| Planting → Inspection | ✅ inspection มี `plot_id` |
| Inspection → No-burn | ✅ `no_burn_request_id` อยู่ใน inspections |
| No-burn → Harvest | ✅ `planting_season_id` เชื่อมทุก table แล้ว |
| Harvest → Factory Intake | ✅ `intake_transactions` มีแล้ว |
| Timeline view | ❌ ยังไม่มี — ข้อมูลอยู่คนละที่ |
| Audit records | ✅ มีใน `member_approval_logs` + `ocr_results` |

**Gap:** ไม่มี traceability timeline หน้าเดียวที่เห็น seed→harvest ต่อสมาชิก  
**แนะนำ:** component `FarmerTraceabilityTimeline` ใน Farmer 360 tab  
**Priority:** 🟡 สำคัญแต่ทำหลัง 360 view ได้  
**ขนาดงาน:** เล็ก (query รวม join แล้ว render timeline)

---

### 4. Factory Intake Module

**สถานะ: ✅ เสร็จแล้ว**

| ส่วน | สถานะ |
|---|---|
| Weigh In / Out | ✅ `intake_transactions` มี gross/net weight |
| Net Weight calculation | ✅ `calculateIntake()` engine ครบ |
| Moisture + deductions | ✅ ตาราง moisture_deductions |
| Pricing + payment calc | ✅ `net_amount`, `price_per_kg` |
| Quality grade A/B/C | ✅ มีใน harvest_bookings + intake_transactions |
| Manual entry | ✅ `/api/intake/manual` |
| CSV batch import | ✅ Z3-6 ทำแล้ว |
| LINE push ใบเสร็จ | ✅ `sendIntakeReceipt()` |
| ERP/Accounting integration | ⏳ Phase 2 — CSV export ทำได้แล้ว |

---

## P2 — Important After Go Live

---

### 5. Contractor Vehicle Platform

**สถานะ: ✅ เสร็จส่วนใหญ่**

| ส่วน | สถานะ |
|---|---|
| Provider registration | ✅ `service_providers` + TruckWizard |
| Fleet management (หลายคัน) | ✅ `provider_vehicles` |
| ราคาต่อคัน (provider ตั้งเอง) | ✅ `price_amount + price_unit` |
| Rating system | ✅ `service_provider_ratings` (5-dimension) |
| Member browse + booking | ✅ `ServiceBrowse` + `BookingModal` |
| Provider dashboard | ✅ `ProviderDashboard` |
| Admin quality report | ✅ `AdminVehicleReport` + popularity score |
| GPS Tracking | ⏳ Phase 2 (ZT-1 ถึง ZT-5 ใน docs) |
| Availability calendar | ⏳ Phase 2 |

---

### 6. Executive Dashboard

**สถานะ: 🟡 Partial**

| KPI | สถานะ |
|---|---|
| Total / Active Members | ✅ `admin-operational-dashboard.tsx` |
| Area by Province | ⚠️ บางส่วน |
| Seed volume | ✅ |
| Harvest scheduled / delivered | ✅ |
| No-burn area / approved | ✅ |
| Planting Season dashboard | ✅ `AdminPlantingSeasons` ทำแล้ว (สรุปต่อรอบ) |
| Service provider stats | ✅ `AdminVehicleReport` |

**Gap:** ยังไม่มี single executive view รวมทุก KPI  
**Priority:** 🟢 ทำได้ภายหลัง — ข้อมูลมีครบ แค่ layout รวม

---

### 7. Offline Field Operations

**สถานะ: ❌ ยังไม่ได้ทำ**

| ส่วน | สถานะ |
|---|---|
| Offline inspection forms | ❌ |
| Photo upload queue | ❌ |
| GPS offline collection | ❌ |
| Background sync | ❌ |

**แนะนำ:** ใช้ Service Worker + IndexedDB  
**Priority:** 🟢 ทำหลัง Pilot — ขึ้นกับ field signal จริง  
**หมายเหตุ:** ถ้า signal ดีพอ (3G+) → ไม่จำเป็น

---

## P3 — Future Enhancements

| Feature | สถานะ | แนะนำ |
|---|---|---|
| Knowledge Base | ❌ | ทำได้ง่าย — เป็น static content + CMS |
| Pest Intelligence | ❌ | ใช้ Gemini API — ต่อยอดจาก wood grading workflow ที่มีอยู่ |
| Planting Economics | ⚠️ บางส่วน | มีต้นทุนใน planting_cycles แต่ยังไม่มี dashboard |
| Harvest Learning Loop | ⚠️ บางส่วน | มี yield variance บางส่วนแล้ว |

---

## สิ่งที่เพิ่มมาใน Session ล่าสุด (ไม่อยู่ใน Gap Analysis เดิม)

| Feature | สถานะ |
|---|---|
| No-burn Seasons (bonus per-ton/per-rai) | ✅ ใหม่ |
| Planting Seasons (รอบกลาง + dashboard) | ✅ ใหม่ |
| Soil Inspection A+C+Lab | ✅ ใหม่ |
| Field assist registration (GPS + PIN) | ✅ ใหม่ |
| Inspector mobile access (nav + ภาคสนาม) | ✅ ใหม่ |
| No-burn ROI calculator + Timeline | ✅ ใหม่ |
| Service Provider Platform (full) | ✅ ใหม่ |
| Vehicle quality report + popularity score | ✅ ใหม่ |
| CSV batch intake import | ✅ ใหม่ (Z3-6) |

---

## สรุปสิ่งที่ควรทำ vs ไม่ควรทำตอนนี้

### ✅ ทำก่อน Go-live (Pilot)

| งาน | เหตุผล | ขนาด |
|---|---|---|
| **Farmer 360** — เพิ่ม tabs ใน AdminMemberDetail | admin ต้องเห็น history ครบเพื่อ support | กลาง |
| **Traceability Timeline** — component เดียว | ต้องแสดง seed→harvest ได้ | เล็ก |
| **Zone 0 infra** — migrations + Vercel env | ระบบ deploy ไม่ได้ถ้าไม่ทำ | เร่งด่วน |

### ⏳ ทำหลัง Pilot

| งาน | เหตุผล |
|---|---|
| GPS Tracking (ZT-1 ถึง ZT-5) | ต้องมีรถจริงก่อน |
| Executive Dashboard รวม | ข้อมูลมีครบแล้ว แค่ layout |
| Offline field ops | ขึ้นกับ signal จริงใน field |
| ERP integration | ต้องรู้ ERP ที่ใช้ก่อน |

### ❌ ไม่ควรทำตอนนี้

| งาน | เหตุผล |
|---|---|
| Knowledge Base | content ยังไม่พร้อม |
| Pest Intelligence | ต้องมี data ก่อน |
| Planting Economics dashboard | รอ harvest data จริงก่อน |
| Harvest Learning Loop (prediction) | ต้องมี historical data ≥1 season |

---

## Pilot Readiness Checklist

```
Infrastructure
  ☐ รัน migrations ทั้งหมด (8+ migrations สะสม)
  ☐ ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน Vercel
  ☐ ทดสอบ LIFF login บนมือถือจริง ทุก role
  ☐ ตรวจ RLS ทุก role path

Features
  ☑ Member registration + OCR
  ☑ Plot + GPS
  ☑ Seed reservation
  ☑ No-burn program + bonus
  ☑ Inspection (soil + cert + lab)
  ☑ Harvest booking + intake + CSV
  ☑ Service provider booking
  ☑ Field staff + inspector mobile

Before expanding beyond Pilot
  ☐ Farmer 360 view
  ☐ Traceability timeline
  ☐ Executive dashboard
```
