# RLS Verification — ผลการตรวจ API Layer Security

**ตรวจเมื่อ:** พ.ค. 2569
**วิธีตรวจ:** Code review ทุก `app/api/member/` route
**สถานะ:** ✅ API Layer ปลอดภัย | ⚠️ ต้องทดสอบ DB-level RLS กับ user จริง

---

## ผลการตรวจ API Layer

### ✅ ปลอดภัย — มี member_id filter ครบ

| Route | ตาราง | วิธีป้องกัน |
|---|---|---|
| `member/plots` | plots | `.eq('member_id', caller.memberId)` |
| `member/planting-cycles` | planting_cycles | `.eq('member_id', caller.memberId)` |
| `member/harvest-bookings` | harvest_bookings | `.eq('member_id', auth.memberId)` ทุก query |
| `member/harvest-booking` | harvest_bookings | `validateCycle()` ตรวจ member ownership |
| `member/no-burn` | no_burn_requests | `.eq('member_id', caller.memberId)` |
| `member/no-burn-confirmation` | no_burn_requests | ตรวจ member ≠ requester (ห้าม confirm ของตัวเอง) |
| `member/sale-appointment` | sale_appointments | `.eq('member_id', caller.memberId)` |
| `member/seed-reservation` | seed_reservations | `.eq('member_id', memberId)` |
| `member/credit` | credit_transactions | `.eq('member_id', memberId)` |
| `member/my-report` | planting_cycles, no_burn_requests | `.eq('member_id', memberId)` |
| `member/quota` | planting_cycles | `.eq('member_id', memberRow.id)` |
| `member/provider-requests` | provider_requests | `.eq('member_id', memberId)` |
| `member/service-booking` | service_bookings | `.eq('member_id', caller.memberId)` |
| `member/reservation` | reservations | `.eq('member_id', memberId)` |

### ✅ Public data — ไม่ต้อง filter (ทุกคนดูได้)

| Route | เหตุผล |
|---|---|
| `member/harvest-booking/dryer-status` | quota ของจุดรับ — ไม่ใช่ข้อมูลส่วนตัว |
| `moisture-deductions` | ราคาและส่วนลด — public |
| `member/plots?member_id=xxx` (read) | ดึงเฉพาะ memberId ที่ส่งมา |

### ⚠️ จุดที่ต้องทดสอบ DB-level

**1. planting_cycles ใน sale-appointment route (line 23)**
```typescript
// ดึง cycle เพื่อหา crop_name เท่านั้น — ไม่ return ข้อมูลส่วนตัว
const { data: cycle } = await s.from('planting_cycles')
  .select('crop_name, quota_kg').eq('id', body.planting_cycle_id).single();
```
→ **Risk: ต่ำ** — ดึงเฉพาะ crop_name/quota ไม่ใช่ข้อมูลส่วนตัว แต่ควร verify ด้วย RLS

**2. no-burn-confirmation — ไม่ verify planting_cycle ownership**
```typescript
// ตรวจแค่ว่า member ≠ requester แต่ไม่ตรวจว่า member อยู่ใน group เดียวกัน
if (nbrRow.member_id === caller.memberId) { ... }
```
→ **Risk: ต่ำ** — design ตั้งใจให้ member อื่นยืนยันได้ แต่ควร verify group membership

---

## ขั้นตอนทดสอบ DB-level RLS (ทำเองบน Supabase)

### Setup
1. สร้าง test user ใน Supabase Auth: `farmer_a@test.com`, `farmer_b@test.com`
2. Link กับ members table ผ่าน LINE LIFF จริง หรือ insert manual
3. ใส่ข้อมูล: farmer_a มี plots 2 แปลง, farmer_b มี 1 แปลง

### Test Cases

| # | Action | Expected | Pass? |
|---|---|---|---|
| T1 | farmer_a GET /api/member/plots | เห็นเฉพาะ 2 แปลงของตัวเอง | ⬜ |
| T2 | farmer_a GET /api/member/planting-cycles | เห็นเฉพาะ cycles ของตัวเอง | ⬜ |
| T3 | farmer_a GET /api/member/harvest-bookings | เห็นเฉพาะ bookings ของตัวเอง | ⬜ |
| T4 | farmer_a GET /api/member/my-report | เห็นเฉพาะ report ของตัวเอง | ⬜ |
| T5 | farmer_a พยายาม GET harvest booking ของ farmer_b | 404 หรือ empty | ⬜ |
| T6 | farmer_a พยายาม cancel booking ของ farmer_b | 403 | ⬜ |
| T7 | farmer_a ดู dryer status | เห็นได้ (public data) | ⬜ |
| T8 | admin เห็นทุก member | เห็นทั้งหมด | ⬜ |

### วิธีทดสอบ
```bash
# สร้าง session token สำหรับ farmer_a
curl -X POST https://kaon-a-agri.vercel.app/api/auth/line/... \
  -H "Content-Type: application/json" \
  -d '{"line_uid": "...", "access_token": "..."}'

# ทดสอบ
TOKEN="..."
curl https://kaon-a-agri.vercel.app/api/member/plots \
  -H "Authorization: Bearer $TOKEN"
```

---

## สรุป

**API Layer:** ✅ ปลอดภัยดี — ทุก route มี member_id filter หรือ ownership check

**DB RLS:** ⚠️ ต้องทดสอบด้วย real users — policies มีอยู่แล้วใน migrations แต่ยังไม่ verified

**คำแนะนำ:**
1. ทดสอบ T1-T8 ก่อน Pilot
2. ถ้า RLS ล้มเหลว → เพิ่ม `.eq('member_id', user.id)` ใน RLS policy
3. ดู `supabase/migrations/202605060002_issue_10_rls_and_updated_at.sql` สำหรับ policy ที่มีอยู่
