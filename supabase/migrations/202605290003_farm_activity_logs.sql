-- Migration: farm_activity_logs
-- ─────────────────────────────────────────────────────────────────────────────
-- Simple field diary / checklist for planting cycles.
-- Members tap one button to log: watering, fertilizing, growth check,
-- pest/disease sighting, heavy rain, or other.
--
-- Pest/disease logs trigger an alert to members in the same province.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.farm_activity_logs (
  id                  uuid primary key default gen_random_uuid(),
  planting_cycle_id   uuid not null references public.planting_cycles(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete cascade,
  plot_id             uuid references public.plots(id) on delete set null,

  -- Activity type
  activity_type       text not null check (activity_type in (
    'water',          -- ให้น้ำ
    'fertilize',      -- ใส่ปุ๋ย
    'growth_check',   -- วัด/สังเกตความเจริญเติบโต
    'pest_found',     -- พบแมลงศัตรูพืช  ← triggers alert
    'disease_found',  -- พบโรคพืช          ← triggers alert
    'heavy_rain',     -- ฝนตกหนัก
    'other'
  )),

  -- Free-text detail
  note                text,

  -- Growth measurement (optional, for growth_check)
  plant_height_cm     numeric(6,1),
  growth_stage        text,   -- เช่น 'V3', 'V6', 'VT', 'R1' สำหรับข้าวโพด

  -- Pest / disease detail (optional)
  pest_name           text,   -- ชื่อแมลง/โรค ถ้าทราบ
  severity            text check (severity in ('low','medium','high')),

  -- GPS (captured at log time)
  gps_lat             numeric(10,7),
  gps_lng             numeric(10,7),

  -- Alert state — set to true once broadcast was sent
  alert_sent          boolean not null default false,

  recorded_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- Indexes
create index if not exists idx_farm_activity_cycle
  on public.farm_activity_logs(planting_cycle_id, recorded_at desc);

create index if not exists idx_farm_activity_member
  on public.farm_activity_logs(member_id, recorded_at desc);

create index if not exists idx_farm_activity_alert_pending
  on public.farm_activity_logs(activity_type, alert_sent)
  where activity_type in ('pest_found','disease_found') and alert_sent = false;

-- RLS
alter table public.farm_activity_logs enable row level security;

create policy farm_log_member_select on public.farm_activity_logs
  for select to authenticated
  using (member_id = public.current_member_id());

create policy farm_log_member_insert on public.farm_activity_logs
  for insert to authenticated
  with check (member_id = public.current_member_id());

-- Admin can see all
create policy farm_log_admin_all on public.farm_activity_logs
  for all to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.auth_user_id = auth.uid()
    )
  );
