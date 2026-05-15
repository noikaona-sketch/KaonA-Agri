-- pickup_locations: จุดรับสินค้า
create table if not exists public.pickup_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  map_url     text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- seed ข้อมูลเริ่มต้น
insert into public.pickup_locations (name, address, active) values
  ('โรงงานหลัก KaonA', 'อำเภอเมือง จังหวัดบุรีรัมย์', true)
on conflict do nothing;

-- pickup_slots: รอบวันที่+เวลา+ความจุ
create table if not exists public.pickup_slots (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.pickup_locations(id) on delete cascade,
  pickup_date     date not null,
  pickup_time     text not null default '09:00-12:00',
  capacity_qty    int not null default 500,  -- รับได้กี่ถุง
  booked_qty      int not null default 0,
  status          text not null default 'open'
    check (status in ('open','full','closed','cancelled')),
  note            text,
  created_by      uuid references public.members(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_pickup_slots_date on public.pickup_slots(pickup_date, status);

alter table public.pickup_locations enable row level security;
alter table public.pickup_slots     enable row level security;

-- ทุกคนอ่านได้ admin แก้ได้
create policy pickup_locations_read on public.pickup_locations for select using (true);
create policy pickup_slots_read     on public.pickup_slots     for select using (true);

create policy pickup_locations_admin on public.pickup_locations for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy pickup_slots_admin on public.pickup_slots for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- เพิ่ม pickup_slot_id ใน seed_reservations
alter table public.seed_reservations
  add column if not exists pickup_slot_id     uuid references public.pickup_slots(id) on delete set null,
  add column if not exists pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  add column if not exists pickup_location_name text,
  add column if not exists pickup_time        text;
