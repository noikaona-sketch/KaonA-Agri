-- Migration: crop care schedule
-- ─────────────────────────────────────────────────────────────────────────────
-- เพิ่ม care_schedule (JSONB) ใน seed_varieties
-- format: [{day, activity, label, icon, note?, warning_days?}]
--   day          = วันหลังปลูก
--   activity     = water | fertilize | pest_check | growth_check | harvest
--   label        = ชื่อที่แสดง เช่น 'ปุ๋ยรอบ 1'
--   icon         = emoji
--   note         = คำแนะนำเพิ่มเติม
--   warning_days = แจ้งเตือนล่วงหน้ากี่วัน (default 1)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.seed_varieties
  add column if not exists care_schedule jsonb default '[]'::jsonb;

comment on column public.seed_varieties.care_schedule is
  'ตารางดูแลพืช [{day,activity,label,icon,note,warning_days}]';

-- เพิ่ม reminder_due_at ใน farm_activity_logs สำหรับ scheduled activities
alter table public.farm_activity_logs
  add column if not exists scheduled_day    int,          -- วันที่ X หลังปลูกตาม schedule
  add column if not exists reminder_due_at  timestamptz,  -- วันที่ควรทำ
  add column if not exists reminder_sent    boolean not null default false,
  add column if not exists is_scheduled     boolean not null default false; -- true = มาจาก template

comment on column public.farm_activity_logs.reminder_due_at is
  'วันที่ระบบแจ้งเตือนให้ทำกิจกรรมนี้';
comment on column public.farm_activity_logs.is_scheduled is
  'true = สร้างอัตโนมัติจาก care_schedule template';

create index if not exists idx_farm_activity_reminder
  on public.farm_activity_logs(reminder_due_at, reminder_sent)
  where reminder_due_at is not null and reminder_sent = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: ตาราง care_schedule มาตรฐาน ข้าวโพดไร่ (90 วัน)
-- ใช้เป็น default ถ้า seed_variety ไม่มี schedule ของตัวเอง
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.crop_care_defaults (
  id          uuid primary key default gen_random_uuid(),
  crop_type   text not null unique,
  care_schedule jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.crop_care_defaults is
  'ตาราง care_schedule มาตรฐานต่อชนิดพืช ใช้เป็น fallback';

insert into public.crop_care_defaults (crop_type, care_schedule) values (
  'ข้าวโพด',
  '[
    {"day":0,   "activity":"plant",        "label":"วันปลูก",               "icon":"🌱", "note":"ระยะ 70-75×20-25 ซม. เมล็ด 3-3.5 กก./ไร่ ลึก 3-5 ซม."},
    {"day":2,   "activity":"check",        "label":"ฉีดยาคุมวัชพืช",        "icon":"🌿", "note":"ฉีดภายใน 2-3 วันหลังปลูก ขณะดินยังชื้น"},
    {"day":7,   "activity":"check",        "label":"ตรวจการงอก",            "icon":"🔍", "note":"ควรงอก 80% ขึ้นไป"},
    {"day":22,  "activity":"fertilize",    "label":"ปุ๋ยรอบ 1 + กำจัดวัชพืช","icon":"🌿", "note":"16-20-0 หรือ 15-15-15 อัตรา 30-50 กก./ไร่ พร้อมกำจัดวัชพืช", "warning_days":2},
    {"day":25,  "activity":"growth_check", "label":"วัดความสูง",             "icon":"📏", "note":"ควรสูง 30-40 ซม."},
    {"day":20,  "activity":"pest_check",   "label":"เฝ้าระวังหนอนกระทู้",   "icon":"🐛", "note":"อายุ 15-40 วัน อ่อนแอต่อ Fall Armyworm มาก ตรวจยอดทุกวัน"},
    {"day":42,  "activity":"fertilize",    "label":"ปุ๋ยรอบ 2 + พูนโคน",    "icon":"🌿", "note":"ยูเรีย 46-0-0 อัตรา 25-30 กก./ไร่ พร้อมพูนโคนต้น", "warning_days":2},
    {"day":50,  "activity":"water",        "label":"เพิ่มน้ำช่วงวิกฤต",     "icon":"💧", "note":"D50-80 ออกดอก+ผสมเกสร ห้ามขาดน้ำเด็ดขาด ผลผลิตลดหากขาดน้ำ"},
    {"day":53,  "activity":"check",        "label":"ออกดอก (แปซิฟิค 339)",  "icon":"🌸", "note":"พันธุ์นี้ออกดอก ~D53 ระยะ VT-R1 สำคัญที่สุด"},
    {"day":65,  "activity":"pest_check",   "label":"ตรวจโรครา/แมลง",        "icon":"🔍", "note":"ระวังโรคราน้ำค้าง ตรวจฝักพัฒนาดีไหม"},
    {"day":80,  "activity":"water",        "label":"ลดการให้น้ำ",            "icon":"💧", "note":"ฝักเริ่มแข็ง ลดน้ำลงได้"},
    {"day":100, "activity":"check",        "label":"ตรวจจุดดำ (Black Layer)","icon":"⏳", "note":"แป้งแข็งแล้ว ความชื้น ~35-38% ยังเก็บเกี่ยวแบบสดได้", "warning_days":3},
    {"day":105, "activity":"harvest",      "label":"เก็บเกี่ยวแบบหักสด",     "icon":"🌽", "note":"ความชื้น ~30-33% มีจุดดำที่โคนเมล็ด เหมาะถ้ามีตู้อบ", "warning_days":3},
    {"day":115, "activity":"harvest",      "label":"เก็บเกี่ยวแบบหักแห้ง",   "icon":"✅", "note":"ความชื้น ~15-20% เปลือกแห้งน้ำตาล เมล็ดสนิท ดีที่สุด", "warning_days":3},
    {"day":120, "activity":"harvest",      "label":"เก็บเกี่ยวด่วน",          "icon":"🚜", "note":"ความชื้น ~14.5% เก็บได้เลย อย่าปล่อยนานเกิน"}
  ]'::jsonb
)
on conflict (crop_type) do update
  set care_schedule = excluded.care_schedule,
      updated_at    = now();

insert into public.crop_care_defaults (crop_type, care_schedule) values (
  'ข้าว',
  '[
    {"day":0,  "activity":"plant",        "label":"วันปักดำ/หว่าน",   "icon":"🌱"},
    {"day":7,  "activity":"check",        "label":"ตรวจการตั้งตัว",   "icon":"🔍"},
    {"day":15, "activity":"fertilize",   "label":"ปุ๋ยรอบ 1",        "icon":"🌿", "note":"แอมโมเนียมซัลเฟต 20-0-0"},
    {"day":30, "activity":"pest_check",  "label":"ตรวจแมลง/โรค",    "icon":"🐛"},
    {"day":45, "activity":"fertilize",   "label":"ปุ๋ยรอบ 2",        "icon":"🌿", "note":"สูตร 16-20-0"},
    {"day":60, "activity":"check",       "label":"ระยะแตกกอ",        "icon":"🌾"},
    {"day":75, "activity":"check",       "label":"ระยะออกรวง",       "icon":"🌸"},
    {"day":90, "activity":"water",       "label":"หยุดให้น้ำ",        "icon":"🚫💧", "note":"ก่อนเกี่ยว 2 สัปดาห์"},
    {"day":110,"activity":"harvest",     "label":"เก็บเกี่ยว",        "icon":"✅"}
  ]'::jsonb
)
on conflict (crop_type) do update
  set care_schedule = excluded.care_schedule,
      updated_at    = now();

-- Unique constraint for upsert idempotency
alter table public.farm_activity_logs
  add constraint if not exists farm_activity_logs_cycle_scheduled_day_unique
    unique (planting_cycle_id, scheduled_day);

-- อัปเดตถ้า already inserted (re-run safe)
update public.crop_care_defaults
set care_schedule = (
  select care_schedule from public.crop_care_defaults where crop_type = 'ข้าวโพด' limit 1
)
where crop_type = 'ข้าวโพด';
