-- เพิ่ม capability ของแต่ละจุดรับ: รับเปียก / รับแห้ง / ความจุเครื่องอบ
-- แต่ละจุดมีโควต้าแยกกัน เฉพาะจุดที่ accepts_wet เท่านั้นที่มี dryer quota

alter table public.pickup_locations
  add column if not exists accepts_wet          boolean not null default true,
  add column if not exists accepts_dry          boolean not null default true,
  add column if not exists dryer_capacity_kg    numeric(12,0) default null,
  add column if not exists default_wet_quota_kg numeric(12,0) default 30000,
  add column if not exists default_dry_quota_kg numeric(12,0) default null,
  add column if not exists sort_order           int     not null default 0;

comment on column public.pickup_locations.accepts_wet          is 'รับข้าวโพดเปียก (มีเครื่องอบ)';
comment on column public.pickup_locations.accepts_dry          is 'รับข้าวโพดแห้ง';
comment on column public.pickup_locations.dryer_capacity_kg    is 'ความจุเครื่องอบต่อวัน กก. (null = ไม่มีเครื่องอบ)';
comment on column public.pickup_locations.default_wet_quota_kg is 'โควต้า default รับเปียกต่อวัน กก.';
comment on column public.pickup_locations.default_dry_quota_kg is 'โควต้า default รับแห้งต่อวัน กก. (null = ไม่จำกัด)';

-- อัปเดตจุดหลักที่มีอยู่ — รับทั้งเปียกและแห้ง มีเครื่องอบ
update public.pickup_locations
  set accepts_wet       = true,
      accepts_dry       = true,
      dryer_capacity_kg = 30000,
      default_wet_quota_kg = 30000,
      sort_order        = 1
  where name = 'โรงงานหลัก KaonA';

-- seed จุดรับที่ 2 (รับเปียกอย่างเดียว ไม่มีเครื่องอบ — รอรถขนไปอบที่โรงงานหลัก)
insert into public.pickup_locations (name, address, active, accepts_wet, accepts_dry, dryer_capacity_kg, default_wet_quota_kg, default_dry_quota_kg, sort_order)
values ('จุดรับที่ 2', 'กรุณากรอกที่อยู่', true, true, false, null, 20000, null, 2)
on conflict do nothing;
