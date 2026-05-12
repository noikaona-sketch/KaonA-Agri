# MVP QA Checklist (Issue #148)

เช็กลิสต์นี้ใช้สำหรับ smoke test เส้นทาง MVP ที่มีอยู่แล้วเท่านั้น (ไม่เพิ่มฟีเจอร์ใหม่)

## Scope

- `/member/register` *(ใน MVP ปัจจุบันแสดงผ่าน member onboarding flow บนหน้า member/home)*
- `/service`
- `/service/register`
- `/service/booking`
- `/field/register-role`
- `/field/assist-registration`
- `/admin-prototype/register-role`
- `/admin-prototype/approvals`
- `/no-burn` *(ใน MVP ปัจจุบันเป็นส่วนหนึ่งของ member flow)*
- `/plots`

## Copy and UX standards (Thai mobile)

- [ ] ปุ่มและหัวข้อใช้คำสั้น อ่านเร็วบนมือถือ
- [ ] ระบุบทบาทชัดเจน เช่น สมาชิก / ทีมบริการ / ทีมภาคสนาม / แอดมิน
- [ ] มี next action ชัดเจน เช่น “กดส่งคำขอ”, “ไปหน้าจองบริการ”
- [ ] เลี่ยงข้อความยาวที่ให้ความรู้สึกแบบเอกสารราชการ

## Status wording (must match exactly)

- [ ] pending = **รออนุมัติ**
- [ ] approved = **อนุมัติแล้ว**
- [ ] rejected = **ไม่อนุมัติ**
- [ ] under review = **รอตรวจสอบ**
- [ ] local draft = **ร่างเฉพาะในเครื่อง**

## MVP / Local / Mock notes

- [ ] หน้า no-burn ระบุชัดว่า GPS และรูปภาพเป็น **Mock**
- [ ] หน้า plots ระบุชัดว่าเป็น **Local draft only**
- [ ] หน้า registration ที่ใช้ localStorage ระบุชัดว่าเป็น **MVP/Local**

## Route smoke checklist

### 1) `/service`
- [ ] หน้าโหลดได้บนมือถือ
- [ ] เห็น 2 ทางเลือกหลัก: สมัครทีมบริการ / จองบริการ
- [ ] ลิงก์ไป `/service/register` และ `/service/booking` ได้

### 2) `/service/register`
- [ ] เห็นฟอร์มส่งคำขอบทบาททีมบริการ
- [ ] ข้อความแจ้งว่าเก็บข้อมูลใน localStorage (MVP/Local)
- [ ] หลังกดส่ง สถานะคำขอเป็น “รออนุมัติ”

### 3) `/service/booking`
- [ ] หน้าโหลดได้พร้อมคำอธิบายขั้นตอนสั้น
- [ ] CTA และข้อความไม่ยาวเกินจำเป็น

### 4) `/field/register-role`
- [ ] หัวข้อแสดงว่าเป็นการสมัครบทบาทภาคสนาม
- [ ] มี next action ชัดเจนให้ส่งคำขอ

### 5) `/field/assist-registration`
- [ ] หัวข้อแสดงว่าเป็นงานช่วยลงทะเบียน
- [ ] ตัวเลือกงานช่วยลงทะเบียนอ่านง่ายบนมือถือ

### 6) `/admin-prototype/register-role`
- [ ] หัวข้อสื่อว่าเป็นการสมัครบทบาทหลังบ้าน
- [ ] มีข้อความ MVP/Local ชัดเจน

### 7) `/admin-prototype/approvals`
- [ ] รายการรออนุมัติแสดงผลได้
- [ ] ปุ่มสถานะใช้คำ “อนุมัติ” / “ไม่อนุมัติ”
- [ ] หากกรอกเหตุผล ช่องข้อความสื่อความหมายชัด

### 8) `/plots`
- [ ] ฟอร์มลงทะเบียนแปลงใช้งานได้
- [ ] ข้อความระบุว่าเป็น Local draft only
- [ ] สถานะร่างใช้คำ “ร่างเฉพาะในเครื่อง”

### 9) `/member/register` and `/no-burn` (embedded flows)
- [ ] member registration flow ใช้คำสถานะตามมาตรฐานเดียวกัน
- [ ] no-burn flow ระบุชัดว่า GPS/Photo เป็น Mock
- [ ] ขั้นตอนถัดไปหลังส่งคำขออ่านง่ายและชัดเจน

## Build gate

- [ ] รัน `npm run build` ผ่านก่อนส่ง PR
