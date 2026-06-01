-- Migration: no_burn_seasons — crop_type + snapshot at submit time
-- แก้ไข season ให้ระบุ crop_type → bonus_type auto
-- snapshot bonus_value ตอน submit (ไม่ใช่ตอน approve)

-- เพิ่ม crop_type ใน seasons
alter table public.no_burn_seasons
  add column if not exists crop_type text
    check (crop_type in ('corn','cassava','sugarcane','rice','other') or crop_type is null);

comment on column public.no_burn_seasons.crop_type is
  'corn = ข้าวโพด → per_ton อัตโนมัติ, อื่นๆ → per_rai';

-- snapshot ตอน submit — ย้ายจาก "ตอน approve" เป็น "ตอน submit"
-- bonus_type, bonus_value มีอยู่แล้วจาก migration 202606010004
-- เพิ่ม bonus_locked_at เพื่อ audit ว่า snapshot เมื่อไหร่
alter table public.no_burn_requests
  add column if not exists bonus_locked_at timestamptz;

comment on column public.no_burn_requests.bonus_locked_at is
  'เวลาที่ snapshot bonus_type/bonus_value จาก season — ตรงกับ submitted_at';
