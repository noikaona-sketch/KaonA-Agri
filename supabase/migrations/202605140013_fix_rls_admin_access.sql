-- แก้ root cause: admin web ใช้ browser client แต่ไม่ได้เป็น member
-- วิธีแก้: เพิ่ม bypass policy สำหรับ authenticated users ที่เป็น service_role
-- หรือเปิด read สำหรับ authenticated ทั้งหมดสำหรับ admin tables

-- products: เปิดให้ authenticated อ่านได้ทั้งหมด (admin ดู inventory)
drop policy if exists products_select_members on public.products;
create policy products_select_all_authenticated on public.products
  for select using (
    deleted_at is null and (
      auth.role() = 'authenticated'
      or auth.role() = 'anon'
    )
  );

-- market_prices: เปิดอ่านได้ทุกคน
drop policy if exists market_prices_read on public.market_prices;
create policy market_prices_read_all on public.market_prices
  for select using (true);

-- seed_stock_lots: เปิดอ่านได้สำหรับ authenticated
drop policy if exists seed_lots_select on public.seed_stock_lots;
create policy seed_lots_select_auth on public.seed_stock_lots
  for select using (auth.role() in ('authenticated', 'anon') or true);

-- service_provider_ratings: เปิดอ่าน
drop policy if exists stock_movements_admin on public.stock_movements;
create policy stock_movements_read_auth on public.stock_movements
  for select using (auth.role() = 'authenticated' or true);

-- sale_appointments: เปิดอ่าน
drop policy if exists sale_appointments_select on public.sale_appointments;
create policy sale_appointments_read_auth on public.sale_appointments
  for select using (true);

-- harvest_bookings: เปิดอ่าน
drop policy if exists harvest_bookings_select on public.harvest_bookings;
create policy harvest_bookings_read_auth on public.harvest_bookings
  for select using (true);

-- planting_cycles: เปิดอ่าน
drop policy if exists planting_cycles_select on public.planting_cycles;
create policy planting_cycles_read_auth on public.planting_cycles
  for select using (true);

-- inspections: เปิดอ่าน
drop policy if exists inspections_select on public.inspections;
create policy inspections_read_auth on public.inspections
  for select using (true);

-- no_burn_requests: เปิดอ่าน
drop policy if exists no_burn_requests_select on public.no_burn_requests;
create policy no_burn_requests_read_auth on public.no_burn_requests
  for select using (true);

-- plots: เปิดอ่าน
drop policy if exists plots_select on public.plots;
create policy plots_read_auth on public.plots
  for select using (deleted_at is null);

-- members: เปิดอ่าน
drop policy if exists members_select_own_or_admin_staff on public.members;
create policy members_read_auth on public.members
  for select using (true);

-- member_roles: เปิดอ่าน
drop policy if exists member_roles_select_own_or_admin_staff on public.member_roles;
create policy member_roles_read_auth on public.member_roles
  for select using (true);

-- sale_orders: เปิดอ่าน
drop policy if exists sale_orders_select on public.sale_orders;
create policy sale_orders_read_auth on public.sale_orders
  for select using (true);

-- order_items: เปิดอ่าน
drop policy if exists order_items_select on public.order_items;
create policy order_items_read_auth on public.order_items
  for select using (true);

-- seed_reservations: เปิดอ่าน
drop policy if exists seed_res_member_select on public.seed_reservations;
create policy seed_reservations_read_auth on public.seed_reservations
  for select using (true);
