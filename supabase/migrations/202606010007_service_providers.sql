-- Migration: service_providers + provider_vehicles
-- Provider สมัครเอง/admin สมัครให้ → มีรถหลายคัน
-- สมาชิกจอง → โทรตกลงราคาเอง

-- ─── 1. service_providers ────────────────────────────────────────────────────
create table if not exists public.service_providers (
  id              uuid        primary key default gen_random_uuid(),
  member_id       uuid        not null unique references public.members(id) on delete cascade,

  -- Profile
  team_name       text        not null,           -- ชื่อทีม/ร้าน
  phone           text        not null,           -- เบอร์ติดต่อหลัก (แสดงให้สมาชิกโทร)
  line_id         text,                           -- LINE ID (optional)
  description     text,                           -- แนะนำตัว

  -- Coverage
  provinces       text[]      not null default '{}',  -- จังหวัดที่บริการ
  districts       text[],                             -- อำเภอ (optional)

  -- Status
  status          text        not null default 'pending'
    check (status in ('pending','approved','suspended')),
  verified_at     timestamptz,
  verified_by     uuid        references public.members(id),

  -- Rating aggregate (updated by trigger/function)
  rating_avg      numeric(3,2) default null,
  rating_count    int          default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_service_providers_status
  on public.service_providers(status) where status = 'approved';

create index if not exists idx_service_providers_provinces
  on public.service_providers using gin(provinces);

-- ─── 2. provider_vehicles (แต่ละคัน) ────────────────────────────────────────
create table if not exists public.provider_vehicles (
  id              uuid        primary key default gen_random_uuid(),
  provider_id     uuid        not null references public.service_providers(id) on delete cascade,

  -- ประเภทและรายละเอียด
  vehicle_type    text        not null
    check (vehicle_type in ('harvester','tractor','transport','water_pump','other')),
  brand           text,                           -- ยี่ห้อ/รุ่น
  plate_number    text,                           -- ทะเบียนรถ
  year            int,                            -- ปีรถ
  description     text,                           -- รายละเอียดเพิ่มเติม อุปกรณ์เสริม

  -- ราคา (provider ตั้งเอง — เป็น reference เท่านั้น ตกลงกันเอง)
  price_amount    numeric(10,2),
  price_unit      text
    check (price_unit in ('per_rai','per_hour','per_trip','per_km') or price_unit is null),
  price_note      text,                           -- หมายเหตุราคา เช่น "รวมน้ำมัน"

  -- สถานะ
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_provider_vehicles_provider
  on public.provider_vehicles(provider_id) where is_active = true;

create index if not exists idx_provider_vehicles_type
  on public.provider_vehicles(vehicle_type) where is_active = true;

-- ─── 3. เพิ่ม provider_vehicle_id ใน service_bookings ────────────────────────
alter table public.service_bookings
  add column if not exists provider_id         uuid
    references public.service_providers(id) on delete set null,
  add column if not exists provider_vehicle_id uuid
    references public.provider_vehicles(id) on delete set null,
  add column if not exists planting_season_id  uuid
    references public.planting_seasons(id) on delete set null,
  add column if not exists plot_id             uuid
    references public.plots(id) on delete set null,
  add column if not exists area_rai            numeric(8,2),
  add column if not exists scheduled_end_date  date,
  add column if not exists member_note         text;    -- รวม note เดิม

-- ─── 4. RLS: provider อ่าน booking ของตัวเองได้ ─────────────────────────────
create policy if not exists sb_provider_select
  on public.service_bookings
  for select
  using (
    provider_id in (
      select sp.id from public.service_providers sp
      join public.members m on m.id = sp.member_id
      where m.auth_user_id = auth.uid()
    )
  );

-- ─── 5. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_service_bookings_provider
  on public.service_bookings(provider_id);

create index if not exists idx_service_bookings_vehicle
  on public.service_bookings(provider_vehicle_id);
