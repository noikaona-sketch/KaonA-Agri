# UAT Script: Member Registration Flow (Z1-2)

## วัตถุประสงค์
ยืนยันว่า flow สมาชิกตั้งแต่เริ่มสมัครผ่าน LINE LIFF จนถึง onboarding และ import สมาชิกแบบ CSV ทำงานครบตาม pilot requirement

## Setup
- Farmer A: ผู้ใช้ใหม่ที่ยังไม่เป็นสมาชิก และเข้าผ่าน LINE บนมือถือจริง
- Farmer B: ผู้ใช้ใหม่สำหรับทดสอบ reject flow
- Admin: account ที่มีสิทธิ์ `service.write` และเข้าหน้า admin members ได้
- ระบบ LINE Messaging API ตั้งค่า token แล้วใน environment ทดสอบ
- เตรียมไฟล์ CSV สมาชิกสำหรับ import test 1 ไฟล์ (อย่างน้อย 2 แถว)

## Test T1: Farmer เปิด LINE และเข้า KaonA mini app
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Farmer A เปิด LINE chat ของ KaonA | เห็น rich menu / ปุ่มเข้า mini app | ⬜ |
| 1.2 | แตะเข้า LIFF mini app | redirect เข้าแอปสำเร็จและ login state ถูกต้อง | ⬜ |
| 1.3 | ระบบตรวจ role/member status | ผู้ใช้ใหม่เห็นหน้า registration ไม่ใช่ dashboard สมาชิก | ⬜ |

## Test T2: Farmer กรอกสมัครสมาชิก
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 2.1 | กรอกชื่อ-สกุล, เบอร์โทร, ที่อยู่/ข้อมูลพื้นฐาน | form validation ผ่านเมื่อกรอกครบ | ⬜ |
| 2.2 | กดส่งใบสมัคร | เห็น success message และสถานะรอตรวจสอบ | ⬜ |
| 2.3 | รีเฟรชหน้า | ยังเห็นสถานะ pending (ไม่ต้องสมัครซ้ำ) | ⬜ |

## Test T3: Admin เห็น pending member
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 3.1 | Admin เปิดหน้า `/admin/members` | เห็นรายการสมาชิกใหม่ของ Farmer A เป็น pending | ⬜ |
| 3.2 | เปิดรายละเอียดสมาชิก | เห็นข้อมูลที่กรอกครบถ้วนและพร้อมตัดสินใจ | ⬜ |

## Test T4: Admin approve และตรวจ LINE push ✅
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 4.1 | Admin กด approve Farmer A | สถานะสมาชิกเปลี่ยนเป็น approved ทันที | ⬜ |
| 4.2 | ตรวจมือถือ Farmer A ใน LINE | ได้รับข้อความอนุมัติสมาชิก (template approve) | ⬜ |
| 4.3 | Farmer A กลับเข้า mini app | เข้า flow สมาชิก/เริ่ม onboarding ได้ | ⬜ |

## Test T5: Admin reject และตรวจ LINE push ❌
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 5.1 | Farmer B สมัครใหม่ให้เป็น pending | มี record รออนุมัติในระบบ | ⬜ |
| 5.2 | Admin กด reject พร้อมระบุเหตุผล | สถานะเปลี่ยนเป็น rejected และบันทึกเหตุผล | ⬜ |
| 5.3 | ตรวจมือถือ Farmer B ใน LINE | ได้รับข้อความปฏิเสธพร้อมเหตุผล | ⬜ |

## Test T6: Onboarding checklist 4 ขั้น
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 6.1 | Farmer A เปิด onboarding หลัง approve | เห็น checklist 4 ขั้นครบ | ⬜ |
| 6.2 | ทำขั้นที่ 1 และ 2 (ข้อมูลโปรไฟล์/ข้อมูลแปลง) | ระบบบันทึกและอัปเดต progress | ⬜ |
| 6.3 | ทำขั้นที่ 3 และ 4 (ข้อมูลรอบปลูก/ยืนยันความพร้อม) | checklist ครบ 4/4 | ⬜ |
| 6.4 | กลับหน้าแรกสมาชิก | ไม่แสดงสถานะ onboarding ค้าง | ⬜ |

## Test T7: CSV member import (upload → review → approve batch)
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 7.1 | Admin เปิดหน้า import สมาชิก และอัปโหลด CSV | ระบบ parse ไฟล์สำเร็จ | ⬜ |
| 7.2 | ตรวจหน้าจอ review | เห็น valid/invalid rows และเหตุผล error ชัดเจน | ⬜ |
| 7.3 | กด approve/confirm batch เฉพาะรายการ valid | ระบบ import สำเร็จและสรุปจำนวนที่บันทึก | ⬜ |
| 7.4 | กลับหน้า member list | เห็นสมาชิกที่ import แล้วในรายการ | ⬜ |

## Exit Criteria
- ผ่านทุก test case T1–T7
- มีหลักฐาน screenshot อย่างน้อย: pending list, approve LINE, reject LINE, onboarding 4/4, CSV review summary
- ถ้าพบ defect ให้บันทึก: step, expected, actual, severity, และแนบหลักฐาน
