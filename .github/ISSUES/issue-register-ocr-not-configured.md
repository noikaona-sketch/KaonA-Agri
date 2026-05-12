# [BUG] OCR สแกนบัตรประชาชนยังใช้งานไม่ได้: `OCR_API_KEY` ไม่มีในระบบ

**Labels:** `bug` `ocr` `env`  
**Priority:** P1 (มี manual fallback แต่ UX ไม่ดี)

## ปัญหา

`POST /api/ocr/id-card/route.ts`:

```ts
const ocrApiKey = process.env.OCR_API_KEY;

if (!ocrApiKey) {
  return NextResponse.json({ error: 'OCR service is not configured' }, { status: 503 });
}
```

ไม่มี `OCR_API_KEY` ใน `.env.local` หรือ Vercel environment variables  
→ OCR จะ return 503 ทุกครั้ง  
→ User ต้องกรอกข้อมูลเองทุกคน (manual fallback ทำงานอยู่ แต่ขาด UX guidance)

## สิ่งที่ต้องทำ

1. **ตั้งค่า env:** เพิ่ม `OCR_API_KEY` (จาก ocr.space หรือ provider อื่น) ใน Vercel + `.env.local`
2. **ปรับ UX:** เมื่อ OCR ไม่ configured → แสดงข้อความชัดเจนว่า "กรุณากรอกข้อมูลเอง" ไม่ใช่ error สีแดง
3. **docs:** เพิ่มใน README ว่า `OCR_API_KEY` ต้องการจากที่ไหน

## สิ่งที่ไม่ต้องทำ

- ไม่ต้องเปลี่ยน OCR provider ในตอนนี้
- ไม่ต้องทำ client-side OCR

## Acceptance Criteria

- [ ] OCR ทำงานได้เมื่อ `OCR_API_KEY` ถูก set
- [ ] เมื่อ OCR ไม่ configured → UI ชี้ไปที่ manual input โดยไม่ error
- [ ] README อธิบาย env variable นี้
