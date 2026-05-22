-- เพิ่ม member_bonus_per_kg ใน campaign_announcements
-- ใช้ตั้งโปรโมชั่นราคาพิเศษสมาชิก KaonA แบบ flat rate มีวันหมดอายุ
-- ราคาสุดท้าย = ราคาฐาน + บวกตามความชื้น + member_bonus_per_kg

alter table public.campaign_announcements
  add column if not exists member_bonus_per_kg numeric(8,4) default null;

comment on column public.campaign_announcements.member_bonus_per_kg
  is 'โบนัสราคาสมาชิก บาท/กก. (flat rate ทุกความชื้น) เช่น 0.20 = ได้เพิ่ม 0.20 บาท/กก.';
