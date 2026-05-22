-- Issue #220 PR4: multi-type promotion system
-- campaign_announcements เพิ่ม promo fields
-- promo_type: 'flat' | 'moisture_below'
-- flat         = ทุกสมาชิก ไม่มีเงื่อนไข
-- moisture_below = ความชื้น < moisture_threshold % เท่านั้น

alter table public.campaign_announcements
  add column if not exists promo_type         text    default null
    check (promo_type in ('flat', 'moisture_below')),
  add column if not exists promo_bonus_per_kg numeric(8,4) default null,
  add column if not exists moisture_threshold  numeric(5,1) default null;

comment on column public.campaign_announcements.promo_type
  is 'ประเภทโปรโมชั่น: flat=ทุกคน, moisture_below=ชื้นต่ำกว่า threshold';
comment on column public.campaign_announcements.promo_bonus_per_kg
  is 'โบนัสราคา บาท/กก. สำหรับโปรโมชั่นนี้';
comment on column public.campaign_announcements.moisture_threshold
  is 'ใช้กับ moisture_below: ความชื้น < ค่านี้ถึงได้รับโปร เช่น 30 = ชื้น < 30%';

-- migrate ข้อมูลเดิม member_bonus_per_kg → promo_type=flat
update public.campaign_announcements
  set promo_type = 'flat', promo_bonus_per_kg = member_bonus_per_kg
  where member_bonus_per_kg is not null and promo_type is null;
