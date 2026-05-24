# UAT Script: Farmer Full Flow (Z9-1)

## วัตถุประสงค์
ยืนยันว่า farmer ใช้งานครบ end-to-end ตั้งแต่เปิด LINE LIFF, login/session, สมัครสมาชิก, onboarding, ทบทวนแปลง/รอบปลูก, จองรับซื้อผลผลิต, ตรวจความพร้อมสภาพอากาศ, ดูคิวอบ, และรับใบเสร็จผ่าน LINE โดยยืนยันสิทธิ์การเข้าถึงเฉพาะข้อมูลของตนเอง

## Setup
- Farmer A: ผู้ใช้ปลายทางหลักสำหรับทดสอบครบ flow (เริ่มจากยังไม่เป็นสมาชิก)
- Farmer B: ผู้ใช้สมาชิกอีกคนสำหรับทดสอบ data isolation
- Admin: account ที่มีสิทธิ์ `service.write` เพื่อ approve สมาชิกและดู queue ฝั่งแอดมิน
- Staff: account ที่มีสิทธิ์ `service.write` เพื่อบันทึก intake ให้จบงาน
- เปิดใช้งาน LINE LIFF และ Messaging API token แล้วใน environment ทดสอบ
- มี pickup slot ล่วงหน้าอย่างน้อย 7 วัน และมีวันตัวอย่างที่ weather risk ต่างระดับ
- Farmer A มีข้อมูล plot + planting cycle หลัง onboarding และมี booking อย่างน้อย 1 รายการ

## Test T1: LINE/LIFF open + login/session
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Farmer A เปิด LINE official chat ของ KaonA | เห็นปุ่ม/Rich menu สำหรับเข้า mini app | ⬜ |
| 1.2 | แตะเปิด LIFF mini app | เข้าแอปสำเร็จ ไม่เกิด error และได้ user context ถูกต้อง | ⬜ |
| 1.3 | ปิดแอปแล้วเปิดซ้ำภายใน session เดิม | ระบบจำ session และไม่บังคับเริ่ม flow ใหม่โดยไม่จำเป็น | ⬜ |

## Test T2: Registration + status lifecycle
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 2.1 | Farmer A กรอกข้อมูลสมัครสมาชิกและส่งฟอร์ม | บันทึกสำเร็จ พร้อมแสดงสถานะ pending | ⬜ |
| 2.2 | Farmer A รีเฟรชหน้า/เข้าใหม่ | ยังเห็นสถานะ pending เดิม (ไม่สร้างคำขอซ้ำ) | ⬜ |
| 2.3 | Admin อนุมัติสมาชิกของ Farmer A | สถานะเปลี่ยนเป็น approved และพร้อมเข้า onboarding | ⬜ |

## Test T3: Onboarding checklist
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 3.1 | Farmer A เข้า onboarding หลัง approve | เห็น checklist ครบตามขั้นที่ระบบกำหนด | ⬜ |
| 3.2 | กรอกข้อมูลโปรไฟล์และข้อมูลแปลง | ระบบบันทึก progress และทำเครื่องหมายขั้นที่เสร็จแล้ว | ⬜ |
| 3.3 | กรอกข้อมูลรอบปลูกและยืนยันความพร้อม | checklist ครบทุกข้อและเข้าสู่หน้าใช้งานหลัก farmer ได้ | ⬜ |

## Test T4: Plot/planting cycle review
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 4.1 | Farmer A เปิดหน้าทบทวนข้อมูลแปลง | เห็น plot ของตนเองพร้อมข้อมูลสำคัญครบ | ⬜ |
| 4.2 | เปิดรายการรอบปลูก (planting cycle) | เห็น cycle ปัจจุบัน/ล่าสุดและสถานะที่สอดคล้องข้อมูลจริง | ⬜ |
| 4.3 | กลับเข้าหน้านี้อีกครั้งหลังรีโหลด | ข้อมูล plot/cycle คงเดิม ไม่หาย และไม่สลับเป็นของสมาชิกคนอื่น | ⬜ |

## Test T5: Harvest booking create/edit/cancel
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 5.1 | Farmer A สร้าง booking ใหม่โดยเลือกวันรับซื้อและน้ำหนักคาดการณ์ | ระบบบันทึกสำเร็จและแสดง booking ในรายการของตนเอง | ⬜ |
| 5.2 | แก้ไข booking ไปวันอื่นที่ยังมีโควต้า | บันทึกสำเร็จและโควต้าวันใหม่อัปเดตถูกต้อง | ⬜ |
| 5.3 | ยกเลิก booking พร้อมยืนยัน | สถานะ booking เป็น cancelled และไม่อยู่ใน active queue | ⬜ |

## Test T6: Weather readiness / rain risk
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 6.1 | Farmer A เปิดฟอร์มจองในวันที่เสี่ยงฝนสูง | เห็นตัวบ่งชี้ความพร้อมอากาศ/ความเสี่ยงฝนชัดเจน | ⬜ |
| 6.2 | เปลี่ยนวันจองเป็นวันเสี่ยงต่ำกว่า | risk indicator และคำแนะนำเปลี่ยนตามวันที่เลือก | ⬜ |
| 6.3 | ยืนยัน booking ในวันที่เหมาะสม | booking ถูกบันทึกพร้อมข้อมูลความพร้อมอากาศที่สอดคล้อง | ⬜ |

## Test T7: Dryer queue visibility
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 7.1 | Farmer A เปิดหน้าสถานะคิวหลังมี booking active | เห็นลำดับคิว/สถานะคิวอบของ booking ตนเอง | ⬜ |
| 7.2 | เมื่อ Staff/Admin อัปเดตสถานะคิวฝั่งปฏิบัติการ | Farmer A รีเฟรชแล้วเห็นสถานะคิวเปลี่ยนตามจริง | ⬜ |
| 7.3 | ตรวจข้อมูลคิวที่แสดง | ไม่เห็นรายละเอียดคิวเชิงลึกของสมาชิกรายอื่นเกินสิทธิ์ | ⬜ |

## Test T8: Intake receipt + LINE notification
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 8.1 | Staff บันทึก intake ให้ booking ของ Farmer A จนสถานะ completed | ระบบปิดงานสำเร็จและบันทึก actual data | ⬜ |
| 8.2 | Farmer A ตรวจใน LINE | ได้รับ intake receipt notification ของรายการตนเอง | ⬜ |
| 8.3 | Farmer A เปิดแอปตรวจประวัติรายการรับซื้อ | เห็นข้อมูลรายการ completed ตรงกับ receipt ที่ได้รับ | ⬜ |

## Test T9: Farmer-only access (data isolation)
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 9.1 | Farmer A เปิดรายการ booking/ประวัติ/โปรไฟล์ | เห็นเฉพาะข้อมูลของ Farmer A เท่านั้น | ⬜ |
| 9.2 | ทดลองเข้าลิงก์ตรงของข้อมูล Farmer B (ถ้ามี id/URL) | ระบบปฏิเสธการเข้าถึงหรือไม่พบข้อมูลตามสิทธิ์ | ⬜ |
| 9.3 | สลับไป login เป็น Farmer B แล้วตรวจรายการ | Farmer B เห็นเฉพาะข้อมูลของตนเอง ไม่เห็นของ Farmer A | ⬜ |

## Exit Criteria
- ผ่านทุก test case T1–T9
- มีหลักฐาน screenshot อย่างน้อย: LIFF open, pending/approved status, onboarding complete, plot/cycle review, booking create-edit-cancel, weather risk indicator, dryer queue, LINE receipt, และการทดสอบ farmer-only access
- ถ้าพบ defect ให้บันทึก: test case, step, expected, actual, severity, owner และแนบหลักฐาน
