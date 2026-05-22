-- เพิ่ม capacity แยกประเภท: เข้าอบ (dryer) vs ขายแห้ง (dry)
-- admin กำหนดโควต้าแต่ละวัน farmer จองตามประเภท

alter table public.pickup_slots
  add column if not exists capacity_kg_dryer  numeric(12,0) default null,
  add column if not exists capacity_kg_dry    numeric(12,0) default null,
  add column if not exists booked_kg_dryer    numeric(12,0) not null default 0,
  add column if not exists booked_kg_dry      numeric(12,0) not null default 0;

comment on column public.pickup_slots.capacity_kg_dryer is 'โควต้ารับเข้าอบ กก./วัน (null = ไม่จำกัด)';
comment on column public.pickup_slots.capacity_kg_dry   is 'โควต้ารับขายแห้ง กก./วัน (null = ไม่จำกัด)';
comment on column public.pickup_slots.booked_kg_dryer   is 'จองเข้าอบแล้ว กก.';
comment on column public.pickup_slots.booked_kg_dry     is 'จองขายแห้งแล้ว กก.';

-- ตาราง intake_quota_template: admin ตั้ง default quota ต่อวันในสัปดาห์
-- เพื่อสร้าง slot ใหม่ได้เร็วโดยไม่ต้องกรอกทุกครั้ง
create table if not exists public.intake_quota_templates (
  id                   uuid primary key default gen_random_uuid(),
  location_id          uuid not null references public.pickup_locations(id) on delete cascade,
  day_of_week          int  not null check (day_of_week between 0 and 6), -- 0=อาทิตย์ 1=จันทร์
  default_capacity_kg_dryer numeric(12,0) default 30000,
  default_capacity_kg_dry   numeric(12,0) default 20000,
  default_time              text not null default '07:00-17:00',
  is_active            boolean not null default true,
  unique (location_id, day_of_week)
);

comment on table public.intake_quota_templates is
  'template โควต้ารับซื้อรายวัน แยกตามวันในสัปดาห์ ใช้สร้าง pickup_slots อัตโนมัติ';

alter table public.intake_quota_templates enable row level security;

create policy intake_quota_admin on public.intake_quota_templates for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy intake_quota_read on public.intake_quota_templates for select using (true);

-- seed template เริ่มต้น (จันทร์-เสาร์ เปิด)
insert into public.intake_quota_templates (location_id, day_of_week, default_capacity_kg_dryer, default_capacity_kg_dry)
select id, d, 30000, 20000
from public.pickup_locations
cross join unnest(array[1,2,3,4,5,6]) as d
on conflict (location_id, day_of_week) do nothing;
