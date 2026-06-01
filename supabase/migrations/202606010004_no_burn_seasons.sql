-- Migration: no_burn_seasons
-- Admin ตั้งรอบโครงการไม่เผา พร้อมกำหนด bonus_type + bonus_value
-- สมาชิกลงทะเบียนอ้างอิง season_id เพื่อดึงโบนัสที่ถูกต้อง

create table if not exists public.no_burn_seasons (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,              -- เช่น "ฤดูกาล 2569 รอบ 1"
  season_year   int         not null,              -- ปี พ.ศ.
  starts_at     date        not null,
  ends_at       date        not null,
  bonus_type    text        not null default 'per_ton'
    check (bonus_type in ('per_ton', 'per_rai')),
  bonus_value   numeric(10,2) not null default 0,  -- บาท/ตัน หรือ บาท/ไร่
  is_active     boolean     not null default true,
  note          text,                              -- หมายเหตุ admin
  created_by    uuid        references public.members(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.no_burn_seasons.bonus_type  is 'per_ton = บาท/ตัน, per_rai = บาท/ไร่';
comment on column public.no_burn_seasons.bonus_value is 'จำนวนโบนัส ต่อหน่วย (ตัน หรือ ไร่)';

-- เชื่อม no_burn_requests → season
alter table public.no_burn_requests
  add column if not exists season_id uuid
    references public.no_burn_seasons(id) on delete set null,
  add column if not exists bonus_type  text,   -- snapshot ตอน approve
  add column if not exists bonus_value numeric(10,2),  -- snapshot
  add column if not exists bonus_amount numeric(12,2); -- คำนวณแล้ว (ไร่×value หรือ ตัน×value)

comment on column public.no_burn_requests.bonus_amount is
  'คำนวณเมื่อ approve: per_rai = area_rai × bonus_value, per_ton = คำนวณตอนชั่งน้ำหนัก';

create index if not exists idx_no_burn_requests_season
  on public.no_burn_requests(season_id);

create index if not exists idx_no_burn_seasons_active
  on public.no_burn_seasons(is_active, starts_at, ends_at)
  where is_active = true;
