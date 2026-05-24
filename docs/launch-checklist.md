# Final Pilot Launch Checklist (Printable) — KaonA-Agri

> Issue: **Z9-6**  
> Version: **v1.0 (Pilot)**  
> Last updated: **2026-05-24**  
> Print format: A4 / ลงชื่อกำกับทุกหัวข้อก่อน Go-Live

---

## How to use this checklist

- ใช้สถานะเดียวกันทุกข้อ: **✅ done** | **⏳ in progress** | **❌ not done**
- ทุกข้อ **ต้องมีวันที่ตรวจ** และ **ผู้ตรวจ**
- ช่อง Evidence ให้ระบุหลักฐาน เช่น URL, screenshot path, SQL result, log id, report export filename
- ห้าม go-live หากมีข้อ critical ที่ยังไม่เป็น ✅ done

---

## 1) Environment Readiness

| Item | Status | Verify Date | Verified By | Evidence |
|---|---|---|---|---|
| Supabase production env variables ครบ (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | ☐ |  |  |  |
| LINE env variables ครบ (`NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_ACCESS_TOKEN`) | ☐ |  |  |  |
| DSS/API keys ครบ (เช่น `GEMINI_API_KEY`, OCR/Document AI keys, external API keys ที่ใช้งานจริง) | ☐ |  |  |  |
| Storage bucket พร้อมใช้งาน (`evidence`, `bill-photos`, `plot-photos`) และ policy ถูกต้อง | ☐ |  |  |  |
| Cron jobs (scheduled jobs) ตั้งค่า production แล้ว และมีผลรันล่าสุด | ☐ |  |  |  |
| Vercel production deploy สำเร็จ + health checks ผ่าน (`/`, เส้นทางหลัก, API setup check) | ☐ |  |  |  |

---

## 2) Roles & Access

| Item | Status | Verify Date | Verified By | Evidence |
|---|---|---|---|---|
| Farmer role เข้าใช้งาน flow ตามสิทธิ์ได้ครบ | ☐ |  |  |  |
| Staff role เข้าใช้งาน flow ตามสิทธิ์ได้ครบ | ☐ |  |  |  |
| Admin role เข้าใช้งาน flow ตามสิทธิ์ได้ครบ | ☐ |  |  |  |
| RLS verification ผ่านตามเอกสาร (`docs/rls-verification.md`) | ☐ |  |  |  |
| Cross-role isolation ถูกต้อง (ไม่มี role ใดเห็นข้อมูลนอกขอบเขต) | ☐ |  |  |  |

---

## 3) End-to-End UAT Pass

> อ้างอิงผล completed docs ต่อไปนี้ และแนบวันที่ run ล่าสุด
>
> - `docs/uat-member-flow.md`
> - `docs/uat-booking-flow.md`
> - `docs/uat-farmer-flow.md`
> - `docs/uat-staff-flow.md`
> - `docs/uat-admin-flow.md`

| UAT Script | Latest Run Date | Owner | Result | Evidence |
|---|---|---|---|---|
| Member flow |  |  | ☐ PASS / ☐ FAIL |  |
| Booking flow |  |  | ☐ PASS / ☐ FAIL |  |
| Farmer flow |  |  | ☐ PASS / ☐ FAIL |  |
| Staff flow |  |  | ☐ PASS / ☐ FAIL |  |
| Admin flow |  |  | ☐ PASS / ☐ FAIL |  |

**Gate:** ต้อง PASS ทุก flow ก่อน Go-Live

---

## 4) Data Verification

| Item | Status | Verify Date | Verified By | Evidence |
|---|---|---|---|---|
| Reports ครบทุกแท็บที่ใช้ใน pilot (รวม accuracy/reconciliation ที่เกี่ยวข้อง) | ☐ |  |  |  |
| ตรวจ expected vs actual ตรงตามตัวอย่างทดสอบ | ☐ |  |  |  |
| Export CSV ใช้งานได้ และไฟล์เปิดอ่านได้ถูกต้อง | ☐ |  |  |  |
| Duplicate ticket prevention ทำงานจริง (ทั้ง manual และ batch flow) | ☐ |  |  |  |
| Moisture deduction คำนวณตรงกับตารางที่ตั้งค่า | ☐ |  |  |  |
| Market price logic ใช้ราคาถูก lot/time และไม่ fallback ผิดเงื่อนไข | ☐ |  |  |  |

---

## 5) LINE Verification

| Item | Status | Verify Date | Verified By | Evidence |
|---|---|---|---|---|
| Approve/Reject member ส่ง push สำเร็จ | ☐ |  |  |  |
| Booking receipt ส่งสำเร็จและข้อความถูกต้อง | ☐ |  |  |  |
| Intake receipt ส่งสำเร็จและข้อมูลตรงกับรายการจริง | ☐ |  |  |  |
| Campaign push ส่งได้ตามกลุ่มเป้าหมายและไม่มี role leakage | ☐ |  |  |  |

---

## 6) Operations Readiness

| Item | Status | Verify Date | Verified By | Evidence |
|---|---|---|---|---|
| Pilot dry run แบบเต็ม flow (วันจำลองจริง) เสร็จสิ้น | ☐ |  |  |  |
| Rollback plan ระบุ trigger + step + owner ชัดเจน | ☐ |  |  |  |
| Issue escalation owner (L1/L2/L3) ระบุชื่อ/ช่องทางติดต่อครบ | ☐ |  |  |  |
| Backup/Export plan ระบุความถี่ + ผู้รับผิดชอบ + จุดเก็บไฟล์ | ☐ |  |  |  |
| Daily close checklist ใช้งานได้จริงและทีมปฏิบัติทำตามได้ | ☐ |  |  |  |

---

## 7) Go-Live Signoff

| Item | Owner | Status | Evidence | Signoff |
|---|---|---|---|---|
| Environment readiness complete |  | ☐ |  |  |
| Roles & access verified |  | ☐ |  |  |
| End-to-end UAT passed |  | ☐ |  |  |
| Data verification passed |  | ☐ |  |  |
| LINE verification passed |  | ☐ |  |  |
| Operations readiness complete |  | ☐ |  |  |
| Final go/no-go decision |  | ☐ GO / ☐ NO-GO |  |  |

---

## Tracking (Z9-6 closure notes)

- [x] `docs/launch-checklist.md` ปรับเป็น Final pilot launch checklist format (printable)
- [x] ครอบคลุมหัวข้อบังคับทั้ง 7 หมวดตาม Issue Z9-6
- [x] Sync issue status ใน `docs/codex-issues.md` แล้ว (ย้าย Z9-6 จากคิวงาน Codex)
- [x] ไม่มีการแก้ auth / RLS policy / migration

