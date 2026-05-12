-- Migration: ระบบวงจรการปลูกแบบสมบูรณ์
-- crop_yield_config: ตั้งค่า quota/yield ต่อพืช
-- planting_cycle_progress: บันทึกความคืบหน้า
-- harvest_bookings: นัดรถเกี่ยว
-- sale_appointments: นัดขายผลผลิต
-- market_prices: ราคากลางที่ admin ตั้ง

-- ── 1. crop_yield_config ─────────────────────────────────────────────
-- ตั้งค่า yield และ quota ต่อชนิดพืช (admin แก้ได้)
create table if not exists public.crop_yield_config (
  id uuid primary key default gen_random_uuid(),
  crop_type text not null unique,         -- ข้าวโพด / ข้าว / มันสำปะหลัง
  seed_to_yield_ratio numeric(10,2) not null default 600,
                                          -- 1 กก.เมล็ด → X กก.ผลผลิต (default 600)
  yield_per_rai numeric(10,2) not null default 1200,
                                          -- กก./ไร่ (ประมาณการณ์)
  quota_per_seed_kg numeric(10,2) not null default 600,
                                          -- โควต้าขายได้ต่อ 1 กก.เมล็ด
  note text,
  updated_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_crop_yield_config_updated_at
before update on public.crop_yield_config
for each row execute function public.set_updated_at();

-- seed ค่าเริ่มต้น
insert into public.crop_yield_config (crop_type, seed_to_yield_ratio, yield_per_rai, quota_per_seed_kg)
values
  ('ข้าวโพด',         600, 1200, 600),
  ('ข้าว',            400, 800,  400),
  ('มันสำปะหลัง',    800, 4000, 800),
  ('อ้อย',           1000, 10000, 1000),
  ('ถั่วเหลือง',      300, 350,  300)
on conflict (crop_type) do nothing;

-- ── 2. เพิ่ม columns ใน planting_cycles ─────────────────────────────
alter table public.planting_cycles
  add column if not exists seed_lot_number text,
  add column if not exists area_planted_rai numeric(10,2),  -- ไร่ที่ปลูกจริง
  add column if not exists actual_harvest_at date,          -- วันเก็บเกี่ยวจริง
  add column if not exists actual_yield_kg numeric(12,2),   -- ผลผลิตจริง (กก.)
  add column if not exists estimated_yield_kg numeric(12,2) generated always as (
    coalesce(area_planted_rai, 0) * 1200  -- default yield_per_rai
  ) stored,
  add column if not exists quota_kg numeric(12,2),          -- โควต้าขาย (กก.)
  add column if not exists notes text;

-- ── 3. planting_cycle_progress ───────────────────────────────────────
-- สมาชิกบันทึกความคืบหน้าระหว่างการเพาะปลูก
create table if not exists public.planting_cycle_progress (
  id uuid primary key default gen_random_uuid(),
  planting_cycle_id uuid not null references public.planting_cycles(id) on delete cascade,
  member_id uuid not null references public.members(id),

  stage text not null check (stage in (
    'prepared',      -- เตรียมดิน
    'planted',       -- ปลูกแล้ว
    'germinated',    -- งอก
    'growing',       -- กำลังเจริญ
    'flowering',     -- ออกดอก
    'pollinating',   -- ผสมเกสร
    'fruiting',      -- ติดผล/ฝัก
    'maturing',      -- กำลังแก่
    'ready',         -- พร้อมเก็บ
    'harvested',     -- เก็บแล้ว
    'issue'          -- พบปัญหา
  )),
  description text,                    -- รายละเอียดเพิ่มเติม
  photo_paths text[],                  -- รูปภาพ
  lat numeric(10,7),                   -- GPS ณ ตอนบันทึก
  lng numeric(10,7),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_cycle on public.planting_cycle_progress(planting_cycle_id, recorded_at desc);

-- ── 4. harvest_bookings ──────────────────────────────────────────────
-- นัดรถเกี่ยว
create table if not exists public.harvest_bookings (
  id uuid primary key default gen_random_uuid(),
  planting_cycle_id uuid not null references public.planting_cycles(id) on delete cascade,
  member_id uuid not null references public.members(id),

  -- รถเกี่ยว
  truck_member_id uuid references public.members(id),  -- truck_owner จากระบบ
  truck_note text,                     -- ถ้าเป็นรถภายนอก

  -- นัดหมาย
  scheduled_date date not null,
  scheduled_time_start text,           -- '08:00'
  scheduled_time_end text,             -- '17:00'
  plot_id uuid references public.plots(id),

  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled')),

  -- ผลลัพธ์
  actual_date date,
  actual_yield_kg numeric(12,2),       -- ผลผลิตที่เก็บได้จริง
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_harvest_bookings_cycle on public.harvest_bookings(planting_cycle_id);
create index if not exists idx_harvest_bookings_date  on public.harvest_bookings(scheduled_date);

create trigger trg_harvest_bookings_updated_at
before update on public.harvest_bookings
for each row execute function public.set_updated_at();

-- ── 5. market_prices ─────────────────────────────────────────────────
-- ราคากลางที่ admin ตั้ง (แก้ได้)
create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  crop_type text not null,
  price_per_kg numeric(10,2) not null,   -- ราคา บาท/กก.
  effective_date date not null,
  note text,
  is_active boolean not null default true,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_market_prices_crop on public.market_prices(crop_type, effective_date desc);

-- seed ราคาเริ่มต้น
insert into public.market_prices (crop_type, price_per_kg, effective_date, note)
values
  ('ข้าวโพด',      8.00,  current_date, 'ราคาเริ่มต้น'),
  ('ข้าว',         10.00, current_date, 'ราคาเริ่มต้น'),
  ('มันสำปะหลัง',  3.50,  current_date, 'ราคาเริ่มต้น')
on conflict do nothing;

-- ── 6. sale_appointments ─────────────────────────────────────────────
-- นัดขายผลผลิต
create table if not exists public.sale_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_number text not null unique,  -- SA-2569-00001

  planting_cycle_id uuid not null references public.planting_cycles(id) on delete cascade,
  member_id uuid not null references public.members(id),

  -- ปริมาณ
  estimated_qty_kg numeric(12,2) not null,   -- ปริมาณที่นัดขาย
  actual_qty_kg numeric(12,2),               -- ปริมาณจริงที่ขาย
  quota_remaining_kg numeric(12,2),          -- โควต้าคงเหลือ

  -- ราคา
  price_per_kg numeric(10,2) not null,       -- ราคา บาท/กก. (อ้างจาก market_prices)
  total_amount numeric(14,2) generated always as (
    coalesce(actual_qty_kg, estimated_qty_kg) * price_per_kg
  ) stored,

  -- นัดหมาย
  appointment_date date not null,
  appointment_time text,                     -- '09:00'
  location_note text,                        -- จุดรับสินค้า

  -- สถานะ
  status text not null default 'scheduled'
    check (status in (
      'scheduled',   -- นัดแล้ว
      'confirmed',   -- ยืนยัน
      'completed',   -- ขายแล้ว
      'cancelled'    -- ยกเลิก
    )),

  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','partial')),
  paid_amount numeric(14,2) not null default 0,

  note text,
  reviewed_by uuid references public.members(id),  -- admin/staff ที่อนุมัติ

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.sale_appointment_seq start 1;

create index if not exists idx_sale_appt_member on public.sale_appointments(member_id);
create index if not exists idx_sale_appt_date   on public.sale_appointments(appointment_date);
create index if not exists idx_sale_appt_status on public.sale_appointments(status);

create trigger trg_sale_appointments_updated_at
before update on public.sale_appointments
for each row execute function public.set_updated_at();

-- ── 7. RLS ───────────────────────────────────────────────────────────
alter table public.crop_yield_config enable row level security;
alter table public.planting_cycle_progress enable row level security;
alter table public.harvest_bookings enable row level security;
alter table public.market_prices enable row level security;
alter table public.sale_appointments enable row level security;

-- crop_yield_config: ทุกคนอ่านได้, admin แก้ได้
create policy crop_yield_select on public.crop_yield_config for select using (true);
create policy crop_yield_update on public.crop_yield_config for update using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy crop_yield_insert on public.crop_yield_config for insert with check (public.current_member_has_role('admin'));

-- planting_cycle_progress: เจ้าของ+admin เห็น
create policy progress_select on public.planting_cycle_progress for select using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('inspector')
);
create policy progress_insert on public.planting_cycle_progress for insert with check (member_id = public.current_member_id());

-- harvest_bookings: เจ้าของ+truck+admin เห็น
create policy harvest_select on public.harvest_bookings for select using (
  member_id = public.current_member_id()
  or truck_member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('field')
);
create policy harvest_insert on public.harvest_bookings for insert with check (member_id = public.current_member_id() or public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy harvest_update on public.harvest_bookings for update using (member_id = public.current_member_id() or public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- market_prices: ทุกคนอ่านได้, admin แก้ได้
create policy market_price_select on public.market_prices for select using (true);
create policy market_price_insert on public.market_prices for insert with check (public.current_member_has_role('admin') or public.current_member_has_role('sales'));

-- sale_appointments: เจ้าของ+admin เห็น
create policy sale_appt_select on public.sale_appointments for select using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);
create policy sale_appt_insert on public.sale_appointments for insert with check (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);
create policy sale_appt_update on public.sale_appointments for update using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);
