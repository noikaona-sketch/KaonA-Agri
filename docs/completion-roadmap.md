# KaonA-Agri — แผนจบงาน (Completion Roadmap)

**สถานะ:** MVP ใกล้พร้อม Pilot ✅ | ยังไม่พร้อม Rollout ❌
**เป้าหมาย Pilot:** 20–50 สมาชิก / 1–2 ทีม / โรงงาน KaonA
**วิธีการ:** ทำทีละ Zone ให้ "จบจริง" ก่อนไป Zone ถัดไป

---

## Zone 0 — Fix ก่อน Pilot (ต้องทำก่อนทุกอย่าง)

**เป้า:** ไม่มี critical bug ที่ทำให้ pilot ล้มเหลว

| # | งาน | เหตุผล | ประมาณเวลา |
|---|---|---|---|
| 0.1 | ทดสอบ LIFF login บนโทรศัพท์จริง ทุก role | LIFF ≠ browser — เคยพังหลังจาก deploy | 2–3 ชั่วโมง |
| 0.2 | Run migrations ทั้งหมดบน Supabase production และ verify | 82 migrations — ยังไม่ confirmed ว่า apply ครบ | 1 ชั่วโมง |
| 0.3 | ตั้ง LINE Channel Access Token ใน Vercel | LINE push ยังส่งไม่ได้ | 30 นาที |
| 0.4 | ทดสอบ RLS กับ user จริง 3 role (farmer/staff/admin) | RLS policy มี แต่ยังไม่ได้ verify กับ user จริง | 2 ชั่วโมง |
| 0.5 | เพิ่ม backup SOP 1 หน้า: rollback คืออะไร ทำยังไง | ถ้า production พัง ไม่มีแผน | 30 นาที |

**Definition of Done:** Login ได้ + approve สมาชิกได้ + จองขายได้ + LINE แจ้งได้

---

## Zone 1 — Member Foundation (ความพร้อม 75% → 90%)

**เป้า:** สมัครสมาชิก → approve → onboarding ครบวงจร

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 1.1 | UAT: สมัครสมาชิกครบทุก path (LINE / import CSV) | ยังไม่มี test script จริง | ง่าย |
| 1.2 | UAT: Admin approve/reject + LINE แจ้งผล | LINE push ยังไม่ verified | ง่าย |
| 1.3 | ตรวจ onboarding checklist ทำงานใน LINE จริง | onboarding มีแล้ว ยังไม่ test | ง่าย |
| 1.4 | ตรวจว่า member เห็นเฉพาะข้อมูลตัวเอง (RLS) | RLS policy มี แต่ยัง mock | กลาง |
| 1.5 | คู่มือ admin: วิธี approve / reject / import | ยังไม่มีเอกสาร | ง่าย |

**Definition of Done:** สมาชิกใหม่ 5 คน สมัครผ่าน LINE → admin approve → ได้รับ LINE แจ้ง → login เข้าได้

---

## Zone 2 — Harvest Booking (ความพร้อม 70% → 90%)

**เป้า:** จองขาย → admin จัดคิว → รับจริง → บันทึกน้ำหนักจริง

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 2.1 | UI กรอกน้ำหนักจริง + ความชื้นจริง หลังรับที่โรงงาน | `actual_received_kg` column มีแล้ว แต่ยังไม่มี UI กรอก | กลาง |
| 2.2 | Admin complete booking + บันทึก actual weight/moisture | เชื่อม admin harvest queue กับ actual fields | กลาง |
| 2.3 | UAT: จอง → แก้ไข → cancel flow | ยังไม่มี test script | ง่าย |
| 2.4 | Admin peak-day alert ทำงานกับข้อมูลจริง | มีแล้ว แต่ยัง mock data | ง่าย |
| 2.5 | เพิ่ม expected vs actual report เบื้องต้น | column มีแล้ว แต่ยังไม่มี UI รายงาน | กลาง |

**Definition of Done:** farmer จอง → admin เห็น queue → รับจริง → กรอก actual weight → report แสดงผล

---

## Zone 3 — No-Burn Workflow (ความพร้อม 50–60% → 80%)

**เป้า:** farmer สมัคร → GPS/รูป → admin ตรวจ → approve → ได้โบนัส

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 3.1 | GPS evidence: ตรวจสอบว่า GPS จริงทำงานใน LINE webview | mock GPS อยู่ — ต้องทดสอบจากแปลงจริง | กลาง |
| 3.2 | Admin GPS review: ใช้งานได้จริง (เพิ่งสร้าง) | ทดสอบกับข้อมูลจริงว่า map แสดงถูก | ง่าย |
| 3.3 | LINE แจ้งผล approve/reject no-burn | LINE push plan มีแล้ว ยังไม่ implement | กลาง |
| 3.4 | โบนัส no-burn คำนวณในรายงาน farmer | รายงาน farmer มีแล้ว แต่ยังไม่ verify กับข้อมูลจริง | ง่าย |
| 3.5 | UAT: farmer → รูป → GPS → admin approve | ยังไม่มี test script | ง่าย |

**Definition of Done:** farmer 3 คนทดสอบส่งรูป GPS จริง → admin approve → LINE แจ้ง → โบนัสคำนวณถูก

---

## Zone 4 — Field Inspection (ความพร้อม 40–50% → 70%)

**เป้า:** admin assign งานตรวจ → inspector ตรวจแปลง → บันทึกผล

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 4.1 | Admin assign inspection ให้ inspector | ยังไม่มี UI assign งาน | กลาง |
| 4.2 | Inspector เห็น task list + กรอกผล | UI มีบางส่วน แต่ยังไม่ครบวงจร | กลาง |
| 4.3 | LINE แจ้ง inspector เมื่อมีงานใหม่ | LINE push plan มีแล้ว | กลาง |
| 4.4 | ผลตรวจแปลงเชื่อมกับ no-burn approval | ยังไม่มี link | ยาก |

**Definition of Done:** admin assign → inspector ได้รับ LINE → บันทึกผล → admin เห็น

---

## Zone 5 — Weather (ความพร้อม 40% → 70%)

**เป้า:** เปลี่ยนจาก mock เป็นข้อมูลจริงจาก Open-Meteo

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 5.1 | Open-Meteo ใน calculator ทดสอบกับ GPS จริง | API พร้อมแล้ว แต่ยังไม่ test end-to-end | ง่าย |
| 5.2 | Weather readiness ใน admin harvest — เปลี่ยนจาก mock | admin harvest-timing-flags ยังเป็น mock | กลาง |
| 5.3 | ทดสอบ rain-adjusted drying rate ว่า logic สมเหตุสมผล | เพิ่งเพิ่ม แต่ยังไม่ validate กับข้อมูลจริง | ง่าย |

**Definition of Done:** calculator แสดงพยากรณ์จาก GPS แปลงจริง (ไม่ใช่ mock)

---

## Zone 6 — Reports (ความพร้อม 35–45% → 70%)

**เป้า:** รายงานขั้นต่ำที่ admin ต้องใช้จริงทุกวัน

| # | งาน | ขาดอะไร | ทำยาก? |
|---|---|---|---|
| 6.1 | รายงานสมาชิก: จำนวน status approved/pending/rejected | ยังไม่มี | ง่าย |
| 6.2 | รายงานการจองขาย: รายวัน รายสัปดาห์ | ยังไม่มี (มีแต่ harvest dashboard) | ง่าย |
| 6.3 | รายงาน expected vs actual น้ำหนัก/ความชื้น | column มีแล้ว แต่ยังไม่มีรายงาน | กลาง |
| 6.4 | รายงานตามรถ/คนขนส่ง (คุณภาพต่อรถ) | ยังไม่มี | กลาง |
| 6.5 | Export CSV พื้นฐาน (member list, booking list) | ยังไม่มี | กลาง |

**Definition of Done:** admin ดูรายงาน 5 ตัวนี้ได้จริงโดยไม่ต้องเข้า Supabase dashboard

---

## Zone 7 — UAT & Go-Live Checklist

**เป้า:** มั่นใจก่อนเปิด Pilot จริง

| # | งาน | รายละเอียด |
|---|---|---|
| 7.1 | UAT Script 3 role | farmer / admin / field staff — ทดสอบทีละ flow |
| 7.2 | RLS verification | member เห็นเฉพาะข้อมูลตัวเอง verify ด้วย user จริง |
| 7.3 | คู่มือ admin 1 หน้า | approve member / manage quota / ดูรายงาน |
| 7.4 | Backup & Rollback SOP | ถ้าระบบพัง ทำอะไร ใครแจ้ง |
| 7.5 | Tick `docs/launch-checklist.md` ให้ครบ | checklist มีอยู่แล้ว ยังว่างอยู่ |
| 7.6 | Soft launch: 5–10 สมาชิกทดสอบจริง | ก่อนเปิด 50 คน |

---

## ลำดับที่แนะนำ

```
Zone 0 (Fix)  →  Zone 1 (Member)  →  Zone 2 (Booking)  →  Zone 7 (UAT)
                                                                  ↓
                                                           Pilot 20–50 คน
                                                                  ↓
Zone 3 (No-burn)  →  Zone 5 (Weather)  →  Zone 6 (Reports)  →  Zone 4 (Inspection)
                                                                  ↓
                                                           Full Rollout
```

**เหตุผล:** Zone 0-2-7 คือ core loop ที่ farmer ใช้จริงทุกวัน ต้องจบก่อน
Zone 3-6 สำคัญแต่ไม่ blocking pilot ได้ทำขนานกัน

---

## สิ่งที่ตัดออกจาก MVP (ทำหลัง Rollout)

- OCR บัตรประชาชนจริง (Document AI)
- ระบบเกรดสมาชิก Bronze/Silver/Gold
- Learning loop (actual vs คาดการณ์ย้อนหลัง)
- Offline fallback สำหรับสัญญาณอ่อน
- Sentry error monitoring

---

*อัปเดตล่าสุด: พ.ค. 2569*
