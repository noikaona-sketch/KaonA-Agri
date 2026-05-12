# [TASK] เพิ่ม env variables ที่จำเป็นสำหรับระบบสมัครสมาชิกให้ครบ

**Labels:** `task` `env` `docs`  
**Priority:** P1

## Environment variables ที่ขาดอยู่

| Variable | ใช้ที่ไหน | สถานะ |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/auth/line`, `/api/member/register` | ❌ ไม่มีใน README |
| `LINE_CHANNEL_ID` | `/api/auth/line`, `/api/member/register` | ❌ ไม่มีใน README (fallback จาก LIFF_ID) |
| `OCR_API_KEY` | `/api/ocr/id-card` | ❌ ไม่มีใน README |
| `NEXT_PUBLIC_SUPABASE_URL` | ทุกที่ | ✅ มีใน README |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ทุกที่ | ✅ มีใน README |
| `NEXT_PUBLIC_LIFF_ID` | LIFF init | ✅ มีใน README |

## สิ่งที่ต้องทำ

1. สร้างไฟล์ `.env.example` ที่ครบถ้วน
2. อัปเดต README ให้ระบุ env ทุกตัวพร้อมวิธีหาค่า
3. เพิ่ม validation ใน `public-env.ts` สำหรับ server-side env

## Acceptance Criteria

- [ ] `.env.example` มีทุก variable ที่ระบบต้องการ
- [ ] README อธิบายวิธีหาค่าแต่ละตัว
- [ ] Dev ใหม่ setup ได้จาก `.env.example` โดยไม่ต้องถามใคร
