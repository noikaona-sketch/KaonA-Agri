-- lot_id ไม่จำเป็นต้องมีตอนจอง (admin assign ทีหลัง)
alter table public.seed_reservations
  alter column lot_id drop not null;

-- variety_id ก็ไม่จำเป็น (บางพันธุ์ไม่มีใน varieties table)
alter table public.seed_reservations
  alter column variety_id drop not null;

-- lot_no ไม่จำเป็นก่อน assign
alter table public.seed_reservations
  alter column lot_no drop not null;

-- เพิ่ม pickup_slot_id ถ้ายังไม่มี
alter table public.seed_reservations
  add column if not exists pickup_slot_id uuid references public.pickup_slots(id) on delete set null,
  add column if not exists pickup_location_name text;

-- เปิด RLS สำหรับ pickup_slots ให้ทุกคนอ่านได้
drop policy if exists pickup_slots_read on public.pickup_slots;
create policy pickup_slots_read_all on public.pickup_slots
  for select using (true);

drop policy if exists pickup_locations_read on public.pickup_locations;
create policy pickup_locations_read_all on public.pickup_locations
  for select using (true);

-- เปิด insert สำหรับ seed_reservations (authenticated users)
drop policy if exists seed_res_member_insert on public.seed_reservations;
create policy seed_res_insert_auth on public.seed_reservations
  for insert with check (true);
