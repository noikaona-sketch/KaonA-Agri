# UAT Script: Admin Management Flow (Z9-3)

## วัตถุประสงค์
ยืนยันว่า admin สามารถบริหารงานทั้งวันได้ครบตั้งแต่ login/session, ควบคุมสมาชิก, ตั้งค่าราคาและความชื้น, จัดการ slot/โควต้า, ติดตาม utilization แบบ realtime, จัดการ Factory API key, สื่อสารด้วย campaign, export รายงาน และปิดวันด้วย reconciliation โดยไม่ละเมิดขอบเขตสิทธิ์

## Setup
- Admin A: account role `admin` ที่เข้าหน้า `/admin` ได้ครบทุกเมนู
- Staff A: account role `staff` สำหรับทดสอบ role boundary
- Farmer A/B: สมาชิกสถานะ pending อย่างน้อย 1 ราย + approved อย่างน้อย 1 ราย
- มีข้อมูล booking/intake ในวันทดสอบอย่างน้อย 3 รายการเพื่อดู utilization และ export
- เตรียมไฟล์ CSV สมาชิกอย่างน้อย 1 ไฟล์ (มี valid + invalid rows)
- เตรียม factory endpoint จำลอง/อุปกรณ์ที่ใช้ API key สำหรับทดสอบ create/disable

## Test T1: Admin login/session
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1.1 | Admin A เปิดหน้า `/admin` และ login | เข้าหน้า admin dashboard ได้สำเร็จ | ⬜ |
| 1.2 | รีเฟรชหน้าและสลับเมนูหลัก 2–3 เมนู | session ยังอยู่ ไม่ถูกเด้งออก | ⬜ |
| 1.3 | ออกจากระบบแล้ว login ใหม่ | กลับเข้าใช้งานได้ และ session ใหม่ทำงานปกติ | ⬜ |

## Test T2: Dashboard visibility
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 2.1 | เปิด dashboard ภาพรวม | เห็นการ์ดสรุป KPI หลักครบ (member/booking/intake/report) | ⬜ |
| 2.2 | ตรวจ timestamp/ข้อมูลล่าสุด | ข้อมูลแสดงเวลาอัปเดตและค่าตรงกับข้อมูลระบบ | ⬜ |
| 2.3 | เปลี่ยนช่วงข้อมูล/รีเฟรช | ค่าบน dashboard อัปเดตตามข้อมูลล่าสุด | ⬜ |

## Test T3: Member approve/reject
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 3.1 | เปิดหน้า `/admin/members` | เห็นรายการสมาชิก pending | ⬜ |
| 3.2 | กด approve สมาชิก Farmer A | สถานะเปลี่ยนเป็น approved และมีบันทึกการอนุมัติ | ⬜ |
| 3.3 | กด reject สมาชิก Farmer B พร้อมเหตุผล | สถานะเปลี่ยนเป็น rejected และเก็บเหตุผลครบ | ⬜ |

## Test T4: Member CSV import + review
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 4.1 | อัปโหลดไฟล์ CSV สมาชิก | ระบบ parse ไฟล์สำเร็จ | ⬜ |
| 4.2 | ตรวจหน้าจอ review | แสดงสรุป X valid / Y invalid พร้อมเหตุผลรายแถว | ⬜ |
| 4.3 | ยืนยัน import เฉพาะ valid rows | ระบบบันทึกสำเร็จและสรุปจำนวนที่นำเข้า | ⬜ |

## Test T5: Market price setup
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 5.1 | เปิดเมนูตั้งราคา `market_prices` | เห็นราคาปัจจุบันและประวัติที่เกี่ยวข้อง | ⬜ |
| 5.2 | ปรับราคาฐานสำหรับวันทดสอบ | บันทึกสำเร็จและสะท้อนในหน้าคำนวณ/จอง | ⬜ |
| 5.3 | ตรวจธุรกรรมที่อ้างราคาฐาน | ระบบใช้ราคาล่าสุดตามที่ตั้งค่า | ⬜ |

## Test T6: Moisture deduction setup
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 6.1 | เปิดเมนู `moisture_deductions` | เห็นตารางช่วงความชื้นและอัตราหัก | ⬜ |
| 6.2 | เพิ่ม/แก้ไขช่วงความชื้น 1 รายการ | validate ผ่านและบันทึกค่าใหม่ได้ | ⬜ |
| 6.3 | ตรวจผลคำนวณตัวอย่าง | ส่วนลดความชื้นคำนวณตาม rule ใหม่ถูกต้อง | ⬜ |

## Test T7: Campaign announcement
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 7.1 | สร้าง campaign announcement ใหม่ | บันทึกข้อความสำเร็จและสถานะพร้อมเผยแพร่ | ⬜ |
| 7.2 | เลือกกลุ่มเป้าหมายแล้ว publish | ระบบส่งประกาศตามกลุ่มที่เลือก | ⬜ |
| 7.3 | ตรวจรายการ campaign | เห็น campaign ที่เพิ่งสร้างในประวัติ | ⬜ |

## Test T8: Pickup slot/quota management
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 8.1 | เปิดเมนูจัดการ slot รับซื้อ | เห็น slot รายวันและค่า quota ต่อจุดรับ | ⬜ |
| 8.2 | สร้าง slot ใหม่จาก template | ระบบสร้างหลายวันตาม template สำเร็จ | ⬜ |
| 8.3 | ปรับ quota ของวันหนึ่งแล้วบันทึก | quota ใหม่แสดงผลทันทีและใช้ได้จริง | ⬜ |

## Test T9: Realtime utilization monitoring
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 9.1 | เปิด harvest queue/dashboard | เห็น utilization ต่อวัน/จุดรับเป็นค่าปัจจุบัน | ⬜ |
| 9.2 | ให้มี booking ใหม่/ยกเลิก 1 รายการ | utilization อัปเดตตามเหตุการณ์โดยไม่ต้อง login ใหม่ | ⬜ |
| 9.3 | จำลองวันใกล้เต็มโควต้า | ระบบแสดง peak-day หรือ overload alert ชัดเจน | ⬜ |

## Test T10: Factory API key create/disable
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 10.1 | เปิดหน้า Factory API key management | เห็นรายการ key เดิมและสถานะ active/inactive | ⬜ |
| 10.2 | สร้าง key ใหม่ 1 รายการ | ได้ key ใหม่พร้อม metadata การสร้าง | ⬜ |
| 10.3 | disable key ที่สร้างเมื่อครู่ | key ถูกปิดใช้งานและเรียก API ด้วย key นี้ไม่ผ่าน | ⬜ |

## Test T11: Reports export
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 11.1 | เปิด `/admin/reports` และตรวจแต่ละ tab | เห็นข้อมูลรายงานครบตามที่กำหนดในระบบ | ⬜ |
| 11.2 | เลือกช่วงวันที่แล้ว export CSV | ดาวน์โหลดไฟล์สำเร็จ | ⬜ |
| 11.3 | เปิดไฟล์ CSV ที่ export | คอลัมน์และจำนวนแถวตรงกับข้อมูลบนหน้ารายงาน | ⬜ |

## Test T12: Reconciliation / daily close
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 12.1 | เปิดหน้าปิดงานประจำวัน (daily close) | เห็นยอด expected/actual และรายการค้างปิด | ⬜ |
| 12.2 | ทำ reconciliation ให้ครบแล้วกดยืนยันปิดวัน | ระบบบันทึกการปิดวันสำเร็จและล็อกข้อมูลที่ปิดแล้ว | ⬜ |
| 12.3 | export สรุปหลังปิดวัน | ได้รายงานสรุปประจำวันสำหรับส่งต่อบัญชี/โรงงาน | ⬜ |

## Test T13: Role permission boundary
| Step | Action | Expected | Pass? |
|---|---|---|---|
| 13.1 | Login เป็น Staff A แล้วพยายามเข้าหน้า admin-only สำคัญ | ระบบปฏิเสธการเข้าถึงตาม role policy | ⬜ |
| 13.2 | Login เป็น Farmer แล้วพยายามเข้าหน้า admin dashboard | ระบบ redirect/deny อย่างถูกต้อง | ⬜ |
| 13.3 | กลับมา login เป็น Admin A และทำรายการเดิม | Admin เข้าถึงและทำงานได้ครบโดยไม่ติด permission error | ⬜ |

## Exit Criteria
- ผ่านทุก test case T1–T13
- มีหลักฐาน screenshot อย่างน้อย: admin session, dashboard KPI, member approve/reject, CSV review summary, market/moisture setup, campaign publish, slot template + quota edit, utilization alert, API key create/disable, reports export, daily close, และ permission boundary
- หากพบ defect ให้บันทึก: test case, step, expected, actual, severity, owner และแนบหลักฐาน
