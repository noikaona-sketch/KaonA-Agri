-- Z3-1: harvest_bookings economics fields + factory_api_keys + intake_logs
-- อ้างอิง: docs/intake-data-layer-spec.md

alter table public.harvest_bookings
  -- ช่องทางนำเข้า
  add column if not exists intake_source      text not null default 'manual'
    check (intake_source in ('manual','factory_api','csv_import','pos_scan')),
  add column if not exists intake_source_ref  text,
  add column if not exists intake_by          uuid references public.members(id),
  add column if not exists intake_location_id uuid references public.pickup_locations(id),

  -- ผลการชั่ง
  add column if not exists gross_weight_kg    numeric(12,2),
  add column if not exists deduct_pct         numeric(5,2),
  add column if not exists net_weight_kg      numeric(12,2),
  add column if not exists scale_ticket_no    text,

  -- ราคาและการชำระ
  add column if not exists price_per_kg       numeric(8,4),
  add column if not exists bonus_per_kg       numeric(8,4) default 0,
  add column if not exists gross_amount       numeric(14,2),
  add column if not exists deduct_amount      numeric(14,2) default 0,
  add column if not exists net_amount         numeric(14,2),
  add column if not exists payment_method     text
    check (payment_method in ('transfer','cash','credit','debit_account', null)),
  add column if not exists payment_ref        text,

  -- คุณภาพ
  add column if not exists quality_grade      text
    check (quality_grade in ('A','B','C','reject', null)),
  add column if not exists rejection_reason   text,

  -- lock หลัง reconcile
  add column if not exists locked_at          timestamptz;

comment on column public.harvest_bookings.intake_source      is 'ช่องทางนำเข้า: manual|factory_api|csv_import';
comment on column public.harvest_bookings.scale_ticket_no    is 'เลขใบชั่ง — idempotency key per location';
comment on column public.harvest_bookings.locked_at          is 'ถ้า set แล้ว ไม่ให้แก้ไขย้อนหลัง';

-- unique: ไม่รับ scale_ticket_no ซ้ำต่อ location
create unique index if not exists idx_harvest_bookings_scale_ticket
  on public.harvest_bookings (intake_location_id, scale_ticket_no)
  where scale_ticket_no is not null;

-- ──────────────────────────────────────────────────────────────────────────────
-- API keys สำหรับระบบโรงงาน
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.factory_api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  key_hash     text not null unique,   -- sha256(raw_key)
  location_id  uuid references public.pickup_locations(id),
  is_active    boolean not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table  public.factory_api_keys          is 'API keys สำหรับระบบโรงงาน/เครื่องชั่ง';
comment on column public.factory_api_keys.key_hash is 'sha256 hash ของ raw key — ไม่เก็บ raw key';

alter table public.factory_api_keys enable row level security;
drop policy if exists factory_api_admin   on public.factory_api_keys;
create policy factory_api_admin on public.factory_api_keys for all
  using (public.current_member_has_role('admin'));

-- ──────────────────────────────────────────────────────────────────────────────
-- Intake audit log
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.intake_logs (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.harvest_bookings(id),
  source        text not null,
  raw_payload   jsonb,
  processed_at  timestamptz not null default now(),
  processed_by  uuid references public.members(id),
  status        text not null default 'success'
    check (status in ('success','error','duplicate')),
  error_message text
);

comment on table public.intake_logs is 'Audit trail ทุก intake — ใช้ debug และ reconcile';

alter table public.intake_logs enable row level security;
drop policy if exists intake_logs_admin  on public.intake_logs;
drop policy if exists intake_logs_member on public.intake_logs;
create policy intake_logs_admin on public.intake_logs for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy intake_logs_member on public.intake_logs for select
  using (
    booking_id in (
      select id from public.harvest_bookings
      where member_id = (select id from public.members where line_user_id = auth.uid()::text)
    )
  );
