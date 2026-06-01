-- Migration: planting_seasons (รอบการปลูกกลาง — admin ตั้ง)
-- รวม planting season + no-burn season เป็น table เดียว
-- สมาชิกเลือก season เมื่อแจ้งปลูก / สมัครไม่เผา / จองเมล็ด / จองขาย

-- ─── Table หลัก ──────────────────────────────────────────────────────────────
create table if not exists public.planting_seasons (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,           -- "ข้าวโพดรอบ 1/2569"
  season_year     int         not null,           -- ปี พ.ศ.
  crop_type       text        not null            -- 'corn'|'cassava'|'sugarcane'|'rice'|'other'
    check (crop_type in ('corn','cassava','sugarcane','rice','other')),
  planting_start  date        not null,           -- เริ่มลงแปลงได้
  planting_end    date        not null,           -- สิ้นสุดการลงแปลง
  harvest_start   date,                           -- คาดเก็บเกี่ยวเริ่ม
  harvest_end     date,                           -- คาดเก็บเกี่ยวสิ้นสุด
  registration_opens  date,                       -- เปิดให้สมาชิกเลือกรอบนี้
  registration_closes date,                       -- ปิดรับ
  -- โบนัสไม่เผา (รวม no_burn_seasons ไว้ที่นี่)
  noburn_bonus_type   text    not null default 'per_ton'
    check (noburn_bonus_type in ('per_ton','per_rai')),
  noburn_bonus_value  numeric(10,2) not null default 0,
  -- เมล็ดพันธุ์ quota
  seed_quota_kg   numeric(12,2),                  -- โควต้ารวมกก. (null = ไม่จำกัด)
  is_active       boolean     not null default true,
  note            text,
  created_by      uuid        references public.members(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.planting_seasons is
  'รอบการปลูกกลางที่ admin ตั้ง — สมาชิกเลือกเข้าร่วม';
comment on column public.planting_seasons.noburn_bonus_value is
  'ราคาที่ snapshot ตอน submit no_burn_request — lock ต่อรายคน';

-- ─── เชื่อม planting_cycles → season ────────────────────────────────────────
alter table public.planting_cycles
  add column if not exists planting_season_id uuid
    references public.planting_seasons(id) on delete set null;

-- ─── เชื่อม seed_reservations → season ──────────────────────────────────────
alter table public.seed_reservations
  add column if not exists planting_season_id uuid
    references public.planting_seasons(id) on delete set null;

-- ─── เชื่อม harvest_bookings → season ───────────────────────────────────────
alter table public.harvest_bookings
  add column if not exists planting_season_id uuid
    references public.planting_seasons(id) on delete set null;

-- ─── เชื่อม no_burn_requests → planting_season (แทน no_burn_seasons) ────────
alter table public.no_burn_requests
  add column if not exists planting_season_id uuid
    references public.planting_seasons(id) on delete set null;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_planting_seasons_active
  on public.planting_seasons(is_active, planting_start, planting_end)
  where is_active = true;

create index if not exists idx_planting_cycles_season
  on public.planting_cycles(planting_season_id);

create index if not exists idx_seed_reservations_season
  on public.seed_reservations(planting_season_id);

create index if not exists idx_harvest_bookings_season
  on public.harvest_bookings(planting_season_id);

create index if not exists idx_no_burn_requests_planting_season
  on public.no_burn_requests(planting_season_id);
