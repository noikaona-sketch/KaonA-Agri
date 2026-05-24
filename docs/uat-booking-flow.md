# UAT Script: Harvest Booking Flow (Z2-4)

## วัตถุประสงค์
ยืนยันว่า flow การจองขายผลผลิตตั้งแต่สร้าง booking, แก้ไข/ยกเลิก, การจัดการกรณีโควต้าเต็ม, ความพร้อมอากาศ/ความเสี่ยงฝน, การปิดงานคาด vs จริง และการรับซื้อผ่าน CSV ทำงานครบตาม pilot requirement

## Setup
- Farmer A: สมาชิก approved พร้อม `planting_cycle` และมีผลผลิตคาดการณ์
- Farmer B: สมาชิก approved สำหรับทดสอบกรณีโควต้าเต็ม
- Admin: account ที่มีสิทธิ์ `service.write` และเข้าหน้า `/admin/harvest` + `/admin/reports`
- Staff: account ที่มีสิทธิ์ `service.write` และเข้าหน้า `/harvest/intake`
- มี pickup slot ล่วงหน้าอย่างน้อย 7 วัน และกำหนดโควต้าต่อวันชัดเจน
- ระบบ LINE Messaging API ตั้งค่า token แล้วใน environment ทดสอบ
- เตรียมไฟล์ CSV intake สำหรับทดสอบ preview/commit อย่างน้อย 2 แถว (มีทั้ง valid และ invalid)

## Test T1: Farmer สร้าง booking ใหม่
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Farmer A เปิด `/harvest/book` | เห็นฟอร์มจองวันเกี่ยวพร้อมข้อมูลคิวและโควต้า | ⬜ |
| 1.2 | เลือก planting cycle, จุดรับ, วันที่ต้องการ | ระบบแสดง utilization ของวันนั้นแบบ realtime | ⬜ |
| 1.3 | กรอกน้ำหนักคาดการณ์และยืนยันการจอง | บันทึกสำเร็จและแสดง success message | ⬜ |
| 1.4 | Admin เปิด harvest queue | เห็น booking ใหม่ของ Farmer A ในคิว | ⬜ |

## Test T2: Booking edit/cancel flow
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 2.1 | Farmer A เปิดรายการ booking ของตนเอง | เห็น booking ที่เพิ่งสร้างพร้อมปุ่มแก้ไข/ยกเลิก | ⬜ |
| 2.2 | แก้ไขวันที่รับซื้อเป็นวันใหม่ที่ยังไม่เต็ม | ระบบบันทึกสำเร็จและคิว/โควต้าวันใหม่อัปเดต | ⬜ |
| 2.3 | Admin รีเฟรช harvest queue | เห็น booking ย้ายไปวันใหม่ถูกต้อง | ⬜ |
| 2.4 | Farmer A กด cancel booking พร้อมยืนยัน | สถานะ booking เปลี่ยนเป็น cancelled | ⬜ |
| 2.5 | Admin ตรวจ harvest queue อีกครั้ง | ไม่เห็น booking ในรายการ active queue แล้ว | ⬜ |

## Test T3: Quota full behavior
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 3.1 | ตั้งค่าหรือจำลองให้ slot วัน X utilization = 100% | วัน X แสดงสถานะเต็ม (quota full) ชัดเจน | ⬜ |
| 3.2 | Farmer B พยายามจองวัน X | ระบบไม่อนุญาตให้จอง และแสดงข้อความโควต้าเต็ม | ⬜ |
| 3.3 | Farmer B เลือกวันอื่นที่ยังมีโควต้า | จองสำเร็จได้ตามปกติ | ⬜ |
| 3.4 | Admin เปิด queue dashboard | เห็น peak-day/overload alert ตามเงื่อนไขที่ระบบกำหนด | ⬜ |

## Test T4: Weather readiness และ rain risk
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 4.1 | Farmer เปิดหน้าจองในวันที่มีฝนเสี่ยงสูง | เห็น weather readiness/rain risk indicator | ⬜ |
| 4.2 | เปลี่ยนวันจองเป็นวันที่ความเสี่ยงต่ำกว่า | indicator และคำแนะนำปรับตามวันใหม่ | ⬜ |
| 4.3 | ยืนยันการจองในวันเสี่ยงต่ำ | booking ถูกบันทึกพร้อมข้อมูล/คำแนะนำที่สอดคล้องสภาพอากาศ | ⬜ |

## Test T5: Expected vs Actual harvest completion
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 5.1 | Staff เปิด `/harvest/intake` แล้วเลือก booking ที่รอดำเนินการ | เห็นข้อมูลงานและค่า expected จาก booking | ⬜ |
| 5.2 | กรอก actual received kg, moisture, quality grade แล้วบันทึกปิดงาน | booking เปลี่ยนสถานะเป็น completed และเก็บ actual fields ครบ | ⬜ |
| 5.3 | Farmer ตรวจ LINE | ได้รับ LINE receipt หลัง intake สำเร็จ | ⬜ |
| 5.4 | Admin เปิด `/admin/reports` tab accuracy | เห็นข้อมูล expected vs actual ของ booking เดียวกัน | ⬜ |

## Test T6: Intake CSV complete flow (preview → commit)
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 6.1 | Staff/Admin เปิดหน้า intake CSV และอัปโหลดไฟล์ | ระบบ parse สำเร็จและเข้าสู่โหมด preview | ⬜ |
| 6.2 | ตรวจรายการ preview | เห็นสรุป X valid / Y errors พร้อมเหตุผลแต่ละแถว | ⬜ |
| 6.3 | ตรวจแถว error (เช่น duplicate ticket / invalid moisture) | ระบบกันไม่ให้แถวผิดเข้าสู่ commit | ⬜ |
| 6.4 | กด commit สำหรับ valid rows | ระบบบันทึก batch สำเร็จและแจ้งจำนวนรายการที่สำเร็จ | ⬜ |
| 6.5 | Farmer ที่เกี่ยวข้องตรวจ LINE | ได้รับ receipt ตามรายการที่ commit สำเร็จ (fail silently ได้หาก LINE มีปัญหา) | ⬜ |
| 6.6 | Admin เปิดรายงานหลัง commit | เห็นข้อมูล intake/actual เพิ่มขึ้นตาม batch ที่บันทึก | ⬜ |

## Exit Criteria
- ผ่านทุก test case T1–T6
- มีหลักฐาน screenshot อย่างน้อย: booking create, edit/cancel, quota full message, weather risk indicator, report expected vs actual, CSV preview/commit summary
- ถ้าพบ defect ให้บันทึก: test case, step, expected, actual, severity, owner และแนบหลักฐาน
