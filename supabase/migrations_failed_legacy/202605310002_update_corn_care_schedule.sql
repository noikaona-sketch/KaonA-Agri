-- อัปเดต care_schedule ข้าวโพด ตามข้อมูลจริงพันธุ์แปซิฟิค 339
-- อายุเก็บเกี่ยว 105-120 วัน, ออกดอก D53
-- ความชื้น: D100=35-38%, D105=30-33%, D110=25-28%, D115=15-20%, D120=14.5%

insert into public.crop_care_defaults (crop_type, care_schedule) values (
  'ข้าวโพด',
  '[
    {"day":0,   "activity":"plant",        "label":"วันปลูก",                "icon":"🌱", "note":"ระยะ 70-75×20-25 ซม. เมล็ด 3-3.5 กก./ไร่"},
    {"day":2,   "activity":"check",        "label":"ฉีดยาคุมวัชพืช",         "icon":"🌿", "note":"ฉีดภายใน 2-3 วัน ขณะดินยังชื้น"},
    {"day":7,   "activity":"check",        "label":"ตรวจการงอก",             "icon":"🔍", "note":"ควรงอก 80% ขึ้นไป"},
    {"day":20,  "activity":"pest_check",   "label":"เฝ้าระวังหนอนกระทู้",    "icon":"🐛", "note":"D15-40 อ่อนแอต่อ Fall Armyworm ตรวจยอดทุกวัน", "warning_days":1},
    {"day":22,  "activity":"fertilize",   "label":"ปุ๋ยรอบ 1 + กำจัดวัชพืช","icon":"🌿", "note":"16-20-0 หรือ 15-15-15 อัตรา 30-50 กก./ไร่", "warning_days":2},
    {"day":25,  "activity":"growth_check","label":"วัดความสูง",              "icon":"📏", "note":"ควรสูง 30-40 ซม. (V5-V6)"},
    {"day":42,  "activity":"fertilize",   "label":"ปุ๋ยรอบ 2 + พูนโคน",     "icon":"🌿", "note":"ยูเรีย 46-0-0 อัตรา 25-30 กก./ไร่ พร้อมพูนโคน", "warning_days":2},
    {"day":50,  "activity":"water",       "label":"น้ำช่วงวิกฤต (ออกดอก)",  "icon":"💧", "note":"D50-80 ห้ามขาดน้ำเด็ดขาด ผลผลิตลดถ้าขาดน้ำ"},
    {"day":53,  "activity":"check",       "label":"ออกดอก/ผสมเกสร",          "icon":"🌸", "note":"แปซิฟิค 339 ออกดอก ~D53 ระยะ VT-R1 สำคัญที่สุด"},
    {"day":65,  "activity":"pest_check",  "label":"ตรวจโรครา/แมลง",         "icon":"🔍", "note":"ระวังโรคราน้ำค้าง", "warning_days":1},
    {"day":100, "activity":"check",       "label":"ตรวจ Black Layer",        "icon":"⏳", "note":"ความชื้น ~35-38% แป้งแข็งแล้ว ยังไม่ควรเก็บถ้าไม่มีตู้อบ", "warning_days":3},
    {"day":105, "activity":"harvest",     "label":"เก็บเกี่ยวแบบหักสด",      "icon":"🌽", "note":"ความชื้น ~30-33% มีจุดดำที่โคนเมล็ด", "warning_days":3},
    {"day":115, "activity":"harvest",     "label":"หักแห้ง — ดีที่สุด",      "icon":"✅", "note":"ความชื้น ~15-20% เปลือกน้ำตาล เมล็ดสนิท โดนหักน้ำหนักน้อยที่สุด", "warning_days":3},
    {"day":120, "activity":"harvest",     "label":"เก็บเกี่ยวด่วน",           "icon":"🚜", "note":"ความชื้น ~14.5% อย่าปล่อยนานเกิน"}
  ]'::jsonb
)
on conflict (crop_type) do update
  set care_schedule = excluded.care_schedule,
      updated_at    = now();
