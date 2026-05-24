# UAT Script: Staff Intake Flow (Z9-2)

## วัตถุประสงค์
ยืนยันว่า staff สามารถทำงานรับซื้อได้ครบตั้งแต่ login/session, ตรวจคิวรับซื้อ, ทำ intake ทั้งกรณีมี/ไม่มี booking, ตรวจ moisture/weight, ใช้ CSV preview → commit, จัดการ duplicate ticket, ปิดงาน intake และส่ง receipt/LINE ได้ โดยคงขอบเขตสิทธิ์ staff-only อย่างถูกต้อง

## Setup
- Staff A: account ที่มีสิทธิ์ `service.write` และเข้าหน้า `/harvest/intake` ได้
- Farmer A/B: สมาชิก approved พร้อม booking active สำหรับวันทดสอบ
- Admin: account สำหรับตรวจผลรายงาน/คิว และช่วยยืนยันสิทธิ์ข้ามบทบาท
- เตรียมตัวอย่าง walk-in อย่างน้อย 1 รายการ (ไม่มี booking ล่วงหน้า)
- เตรียมไฟล์ CSV intake อย่างน้อย 1 ไฟล์ ที่มีทั้งแถว valid และแถว duplicate ticket
- ระบบ LINE Messaging API ตั้งค่า token ใน environment ทดสอบแล้ว

## Test T1: Staff login/session
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Staff A เปิดแอปผ่านช่องทางที่กำหนด | เข้าหน้า Staff Home ได้ และเห็นเมนู ⚖️ บันทึกรับซื้อ | ⬜ |
| 1.2 | เข้าหน้า `/harvest/intake` | ระบบยืนยัน session สำเร็จ ไม่เด้งกลับหน้า unauthorized | ⬜ |
| 1.3 | ปิด/เปิดแอปใหม่ภายในช่วงเวลา session เดิม | ระบบจำ session และกลับมาทำงานต่อได้ | ⬜ |

## Test T2: Pickup queue visibility
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 2.1 | Staff A เปิดหน้าคิวรับซื้อประจำวัน | เห็นรายการคิววันนี้ครบ พร้อมสถานะแต่ละรายการ | ⬜ |
| 2.2 | ตรวจ quota/progress bar ของวันปัจจุบัน | เห็นค่า utilization สอดคล้องกับจำนวนคิวจริง | ⬜ |
| 2.3 | รีเฟรชหลังมีการเพิ่ม/ยกเลิก booking | คิวอัปเดตตามข้อมูลล่าสุดโดยไม่ต้องออกจากระบบ | ⬜ |

## Test T3: Intake workflow (walk-in + has-booking)
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 3.1 | เลือกรายการ walk-in (ไม่มี booking) แล้วกรอกข้อมูลรับซื้อ | ระบบสร้าง/ผูกข้อมูล intake ได้โดยไม่บังคับ booking เดิม | ⬜ |
| 3.2 | เลือกรายการที่มี booking แล้วเปิดฟอร์ม intake | ระบบ preload ข้อมูล expected และ booking reference ถูกต้อง | ⬜ |
| 3.3 | กรอกข้อมูลฟอร์ม intake ของทั้ง 2 กรณีแล้วกดบันทึกต่อ | ข้อมูลถูก validate ก่อนขั้นยืนยัน และไม่สูญหายระหว่างขั้นตอน | ⬜ |

## Test T4: Moisture/weight verification
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 4.1 | กรอก actual received kg ที่อยู่ในช่วงสมเหตุสมผล | ผ่าน validation และแสดงค่าที่ใช้คำนวณได้ | ⬜ |
| 4.2 | กรอก moisture_pct ที่ valid (เช่น 24–30) | ผ่าน validation และบันทึกค่าได้ | ⬜ |
| 4.3 | กรอก moisture_pct ผิดรูปแบบ/นอกช่วง | ระบบเตือนชัดเจนและไม่ให้ไปขั้น commit จนแก้ถูกต้อง | ⬜ |

## Test T5: CSV preview → commit
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 5.1 | Staff A อัปโหลดไฟล์ CSV intake | ระบบ parse สำเร็จและเข้าสู่หน้าพรีวิว | ⬜ |
| 5.2 | ตรวจ summary ใน preview | แสดงจำนวน X valid / Y errors พร้อมเหตุผลรายแถว | ⬜ |
| 5.3 | กด commit เฉพาะ valid rows | ระบบบันทึกสำเร็จตามจำนวน valid และแจ้งผล batch | ⬜ |

## Test T6: Duplicate ticket handling
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 6.1 | ใช้ CSV ที่มี `scale_ticket_no` ซ้ำกับข้อมูลเดิม | preview ตีเป็น error ประเภท duplicate ticket | ⬜ |
| 6.2 | ตรวจรายการก่อน commit | แถว duplicate ถูกกันออกจากรายการที่จะบันทึก | ⬜ |
| 6.3 | commit batch หลังคัดแถวถูกต้องแล้ว | ระบบไม่สร้างข้อมูลซ้ำ และบันทึกเฉพาะแถวที่ผ่านเกณฑ์ | ⬜ |

## Test T7: Intake completion
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 7.1 | Staff A ยืนยันบันทึก intake รายการที่พร้อมปิดงาน | สถานะรายการเปลี่ยนเป็น completed | ⬜ |
| 7.2 | เปิดรายละเอียดรายการหลังปิดงาน | เห็น actual weight/moisture/ticket ครบถ้วน | ⬜ |
| 7.3 | ตรวจ queue หลังปิดงานหลายรายการ | คิวลดลงและสถานะรวมของวันอัปเดตถูกต้อง | ⬜ |

## Test T8: Receipt / LINE push
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 8.1 | ปิดงาน intake สำเร็จ 1 รายการ | ระบบออก receipt data สำหรับรายการนั้นได้ | ⬜ |
| 8.2 | Farmer เจ้าของรายการตรวจ LINE | ได้รับข้อความ receipt สำหรับรายการของตนเอง | ⬜ |
| 8.3 | กรณี LINE push ล้มเหลวจำลอง | สถานะ intake ยัง completed (fail silently) และมี log ติดตาม | ⬜ |

## Test T9: Permission boundary (staff-only)
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 9.1 | Login เป็น Farmer แล้วพยายามเข้าหน้า `/harvest/intake` | ระบบปฏิเสธการเข้าถึงหรือ redirect ตามสิทธิ์ | ⬜ |
| 9.2 | Login เป็น Staff แล้วพยายามเข้าหน้า admin-only ที่ไม่มีสิทธิ์ | ระบบบล็อกการเข้าถึงตาม role policy | ⬜ |
| 9.3 | Login สลับ Staff/Admin/Farmer แล้วทดสอบซ้ำ | สิทธิ์การเข้าถึงสอดคล้อง role ทุกกรณี | ⬜ |

## Exit Criteria
- ผ่านทุก test case T1–T9
- มีหลักฐาน screenshot อย่างน้อย: staff home/session, pickup queue + quota bar, intake form (walk-in/has-booking), moisture validation, CSV preview summary, duplicate ticket error, completed intake, LINE receipt, และการทดสอบ staff-only boundary
- หากพบ defect ให้บันทึก: test case, step, expected, actual, severity, owner และแนบหลักฐาน
