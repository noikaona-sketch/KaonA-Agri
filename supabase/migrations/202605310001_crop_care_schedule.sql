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
    {"day":0,  "activity":"plant",        "label":"วันปลูก",          "icon":"🌱", "note":"ระยะปลูก 75×25 ซม. ลึก 3-5 ซม."},
    {"day":5,  "activity":"check",        "label":"ตรวจการงอก",       "icon":"🔍", "note":"ควรงอก 80% ขึ้นไป"},
    {"day":10, "activity":"water",        "label":"ให้น้ำครั้งแรก",   "icon":"💧", "note":"ถ้าฝนไม่ตก ให้น้ำให้ชุ่ม"},
    {"day":14, "activity":"fertilize",   "label":"ปุ๋ยรอบ 1",        "icon":"🌿", "note":"ยูเรีย 46-0-0 อัตรา 25 กก./ไร่ รองพื้น", "warning_days":2},
    {"day":21, "activity":"pest_check",  "label":"ตรวจแมลง",         "icon":"🐛", "note":"ระวังหนอนกระทู้ข้าวโพด"},
    {"day":25, "activity":"growth_check","label":"วัดความสูง",        "icon":"📏", "note":"ควรสูง 30-40 ซม. (V5-V6)"},
    {"day":30, "activity":"fertilize",   "label":"ปุ๋ยรอบ 2",        "icon":"🌿", "note":"สูตร 15-15-15 อัตรา 30 กก./ไร่ แต่งหน้า", "warning_days":2},
    {"day":40, "activity":"water",       "label":"ให้น้ำช่วงออกดอก",  "icon":"💧", "note":"สำคัญมาก อย่าให้ขาดน้ำ"},
    {"day":45, "activity":"check",       "label":"ออกดอก/ผสมเกสร",   "icon":"🌸", "note":"ระยะ VT-R1 สำคัญที่สุด"},
    {"day":55, "activity":"growth_check","label":"ตรวจฝัก",           "icon":"🌽", "note":"ควรเห็นฝักชัดเจน"},
    {"day":65, "activity":"pest_check",  "label":"ตรวจโรคราและแมลง", "icon":"🔍", "note":"ระวังโรคราน้ำค้าง"},
    {"day":75, "activity":"check",       "label":"ประเมินความแก่",    "icon":"⏳", "note":"ดูสีไหมข้าวโพดเริ่มแห้ง"},
    {"day":85, "activity":"harvest",     "label":"เตรียมเก็บเกี่ยว", "icon":"🚜", "note":"ความชื้นควร 25-30%", "warning_days":3},
    {"day":90, "activity":"harvest",     "label":"เก็บเกี่ยว",        "icon":"✅", "note":"ความชื้นมาตรฐาน 14.5%"}
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
