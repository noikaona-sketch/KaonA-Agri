# Launch Checklist — KaonA-Agri

ใช้ไฟล์นี้ก่อน go-live ทุกครั้ง tick ✅ ให้ครบก่อน deploy production

---

## 1. Vercel Environment Variables

ตั้งค่าทุก variable ใน Vercel → Project Settings → Environment Variables
เลือก Environment: **Production** (และ Preview ถ้าต้องการ)

### บังคับ (app จะพังถ้าไม่มี)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_LIFF_ID`
- [ ] `LINE_CHANNEL_ID`
- [ ] `ADMIN_WEB_EMAIL`
- [ ] `ADMIN_WEB_PASSWORD`

### แนะนำ (บาง feature จะไม่ทำงานถ้าไม่มี)
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — แผนที่แปลง
- [ ] `NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET` — อัปโหลดรูป (default: `evidence`)
- [ ] `GEMINI_API_KEY` — AI features

### OCR บัตรประชาชน (ต้องการถ้าใช้ Document AI)
- [ ] `GOOGLE_CLOUD_PROJECT_ID`
- [ ] `GOOGLE_DOCUMENTAI_PROCESSOR_ID`
- [ ] `GOOGLE_DOCUMENTAI_LOCATION`
- [ ] `GOOGLE_DOCUMENTAI_CLIENT_EMAIL`
- [ ] `GOOGLE_DOCUMENTAI_PRIVATE_KEY`

### ห้ามตั้งใน Production
- [ ] `NEXT_PUBLIC_DEV_BYPASS_LINE` — ต้องว่างเปล่าหรือไม่มีใน production

---

## 2. Supabase

- [ ] Apply migrations ครบทั้งหมด  
  ```bash
  npx supabase db push
  # หรือรันใน Supabase Dashboard → SQL Editor ทีละไฟล์จาก supabase/migrations/
  ```
- [ ] ตรวจ RLS policies เปิดอยู่สำหรับทุก table
- [ ] สร้าง Storage buckets: `evidence`, `bill-photos`, `plot-photos`
- [ ] ตั้ง Storage bucket policies ให้ authenticated users อัปโหลดได้

---

## 3. LINE Developers Console

- [ ] LIFF URL ตั้งเป็น `https://kaon-a-agri.vercel.app` (production domain)
- [ ] LIFF Endpoint URL ถูกต้อง (ไม่ใช่ localhost)
- [ ] Channel status: **Published**
- [ ] Webhook URL ตั้งไว้ (ถ้าใช้ LINE Push ในอนาคต)

---

## 4. Build & Deploy

- [ ] `npm run build` ผ่านโดยไม่มี error
- [ ] `npx tsc --noEmit` ผ่าน 0 errors
- [ ] Push ขึ้น `main` branch → Vercel auto-deploy
- [ ] เปิด `https://kaon-a-agri.vercel.app` ได้
- [ ] `/api/admin/check-setup` แสดง ✅ ทุก key ที่จำเป็น

---

## 5. Smoke Test ใน LINE จริง

ทดสอบจากโทรศัพท์จริง เปิดผ่าน LINE Mini App (ไม่ใช่ browser)

### Farmer flow
- [ ] เปิด LIFF URL ใน LINE → login ได้
- [ ] สมัครสมาชิกใหม่ → กรอกข้อมูล → ส่งได้
- [ ] หน้า home แสดง role และชื่อถูกต้อง
- [ ] เพิ่มแปลง → GPS จับพิกัดได้
- [ ] ส่งรูปไม่เผา → อัปโหลดสำเร็จ

### Admin flow
- [ ] เปิด `/admin-login` → login ด้วย ADMIN_WEB_EMAIL/PASSWORD
- [ ] เห็นรายการสมัครสมาชิก pending
- [ ] อนุมัติ/ปฏิเสธได้

### Leader flow (ถ้ามี)
- [ ] เห็น member ในกลุ่มตัวเอง
- [ ] ดูสถานะ no-burn ของ farmer ได้

---

## 6. ก่อนเปิดให้เกษตรกรใช้จริง

- [ ] ทดสอบกับ user จริง 2-3 คนก่อน (soft launch)
- [ ] มีช่องทางติดต่อ support (LINE OA หรือเบอร์โทร) แสดงในแอป
- [ ] แจ้งเกษตรกรว่าต้องเปิดผ่าน LINE ไม่ใช่ browser

