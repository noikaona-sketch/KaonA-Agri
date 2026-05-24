-- Issue #220 PR3: moisture deduction table for calculator
-- ตารางส่วนลดตามความชื้น: admin ตั้ง, farmer ใช้คำนวณรายได้จริง

create table if not exists public.moisture_deductions (
  id               uuid primary key default gen_random_uuid(),
  crop_type        text    not null default 'ข้าวโพด',
  moisture_pct     numeric(5,1) not null,          -- ความชื้น % เช่น 25.0
  weight_deduct_pct numeric(5,2) not null default 0, -- หัก % น้ำหนัก เช่น 5.00 = หัก 5%
  price_deduct_per_kg numeric(8,4) not null default 0, -- หักบาท/กก. เช่น 0.20
  drying_days_per_pct numeric(4,2) not null default 1.0, -- กี่วันถึงจะลด 1% ความชื้น
  note             text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (crop_type, moisture_pct)
);

comment on table  public.moisture_deductions                    is 'ตารางส่วนลดตามความชื้น สำหรับคำนวณราคารับซื้อจริง';
comment on column public.moisture_deductions.weight_deduct_pct  is 'หัก % น้ำหนัก เช่น 5 = หัก 5% ของน้ำหนักที่ชั่ง';
comment on column public.moisture_deductions.price_deduct_per_kg is 'หักออกจากราคา บาท/กก. เช่น 0.20';
comment on column public.moisture_deductions.drying_days_per_pct is 'จำนวนวันที่ใช้ลดความชื้น 1% ค่า default 1 วัน/1%';

-- RLS
alter table public.moisture_deductions enable row level security;

drop policy if exists "admin_all_moisture_deductions"   on public.moisture_deductions;
drop policy if exists "public_read_moisture_deductions" on public.moisture_deductions;

create policy "admin_all_moisture_deductions" on public.moisture_deductions
  for all using (
    public.current_member_has_role('admin') or public.current_member_has_role('staff')
  );

create policy "public_read_moisture_deductions" on public.moisture_deductions
  for select using (is_active = true);

-- seed ตัวอย่าง (ความชื้นระหว่าง 14.5–30%)
insert into public.moisture_deductions
  (crop_type, moisture_pct, weight_deduct_pct, price_deduct_per_kg, drying_days_per_pct, note)
values
  ('ข้าวโพด', 30.0, 0.00, 0.00, 1.0, 'ราคาฐานเปียก — ไม่หักเพิ่ม'),
  ('ข้าวโพด', 28.0, 2.00, 0.10, 1.0, 'ชื้นสูง'),
  ('ข้าวโพด', 25.0, 5.00, 0.20, 1.2, 'ชื้นปานกลาง'),
  ('ข้าวโพด', 22.0, 7.00, 0.30, 1.5, 'ชื้นต่ำ'),
  ('ข้าวโพด', 18.0, 9.00, 0.40, 2.0, 'กึ่งแห้ง'),
  ('ข้าวโพด', 14.5, 11.00, 0.50, 2.5, 'แห้งมาตรฐาน')
on conflict (crop_type, moisture_pct) do nothing;
