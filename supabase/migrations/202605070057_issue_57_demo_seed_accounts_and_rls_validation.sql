-- Issue #57: Demo seed accounts + RLS validation baseline dataset
-- Seeds deterministic demo members/roles and minimal records to validate row-level access behavior.

insert into public.members (id, line_user_id, auth_user_id, citizen_id_masked, full_name, phone, status)
values
  ('11111111-1111-1111-1111-111111111111', 'demo_line_admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '***-**-0001', 'Demo Admin', '0800000001', 'approved'),
  ('22222222-2222-2222-2222-222222222222', 'demo_line_staff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '***-**-0002', 'Demo Staff', '0800000002', 'approved'),
  ('33333333-3333-3333-3333-333333333333', 'demo_line_farmer_a', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '***-**-0003', 'Demo Farmer A', '0800000003', 'approved'),
  ('44444444-4444-4444-4444-444444444444', 'demo_line_farmer_b', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '***-**-0004', 'Demo Farmer B', '0800000004', 'approved'),
  ('55555555-5555-5555-5555-555555555555', 'demo_line_inspector', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '***-**-0005', 'Demo Inspector', '0800000005', 'approved')
on conflict (id) do update set
  line_user_id = excluded.line_user_id,
  auth_user_id = excluded.auth_user_id,
  citizen_id_masked = excluded.citizen_id_masked,
  full_name = excluded.full_name,
  phone = excluded.phone,
  status = excluded.status,
  updated_at = now();

insert into public.member_roles (member_id, role, is_primary)
values
  ('11111111-1111-1111-1111-111111111111', 'admin', true),
  ('22222222-2222-2222-2222-222222222222', 'staff', true),
  ('33333333-3333-3333-3333-333333333333', 'farmer', true),
  ('44444444-4444-4444-4444-444444444444', 'farmer', true),
  ('55555555-5555-5555-5555-555555555555', 'inspector', true)
on conflict (member_id, role) do update set
  is_primary = excluded.is_primary;

insert into public.plots (id, member_id, name, area_rai, lat, lng, accuracy, status, created_by, role_used, timestamp)
values
  ('90000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Farmer A Plot', 8.50, 14.1234567, 100.1234567, 6.5, 'active', '33333333-3333-3333-3333-333333333333', 'farmer', now()),
  ('90000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Farmer B Plot', 10.00, 14.2234567, 100.2234567, 5.8, 'active', '44444444-4444-4444-4444-444444444444', 'farmer', now())
on conflict (id) do update set
  member_id = excluded.member_id,
  name = excluded.name,
  area_rai = excluded.area_rai,
  lat = excluded.lat,
  lng = excluded.lng,
  accuracy = excluded.accuracy,
  status = excluded.status,
  created_by = excluded.created_by,
  role_used = excluded.role_used,
  timestamp = excluded.timestamp,
  updated_at = now();

insert into public.seed_orders (id, member_id, planting_cycle_id, seed_type, quantity_kg, status, reviewed_by, note)
values
  ('91000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', null, 'RD43', 120, 'requested', null, 'Demo farmer A request'),
  ('91000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', null, 'KDML105', 90, 'under_review', '22222222-2222-2222-2222-222222222222', 'Demo farmer B request reviewed by staff')
on conflict (id) do update set
  member_id = excluded.member_id,
  planting_cycle_id = excluded.planting_cycle_id,
  seed_type = excluded.seed_type,
  quantity_kg = excluded.quantity_kg,
  status = excluded.status,
  reviewed_by = excluded.reviewed_by,
  note = excluded.note,
  updated_at = now();

insert into public.inspections (id, no_burn_request_id, plot_id, inspector_member_id, assigned_at, visited_at, result_status, result_note)
values
  ('92000000-0000-0000-0000-000000000001', null, '90000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', now(), null, 'pending', 'Demo assignment for farmer A plot')
on conflict (id) do update set
  no_burn_request_id = excluded.no_burn_request_id,
  plot_id = excluded.plot_id,
  inspector_member_id = excluded.inspector_member_id,
  assigned_at = excluded.assigned_at,
  visited_at = excluded.visited_at,
  result_status = excluded.result_status,
  result_note = excluded.result_note,
  updated_at = now();

create or replace function public.rls_validation_snapshot()
returns table (
  auth_user_id uuid,
  member_id uuid,
  effective_role text,
  visible_members bigint,
  visible_plots bigint,
  visible_seed_orders bigint,
  visible_inspections bigint
)
language sql
stable
as $$
  select
    auth.uid() as auth_user_id,
    public.current_member_id() as member_id,
    public.current_member_effective_role() as effective_role,
    (select count(*) from public.members) as visible_members,
    (select count(*) from public.plots) as visible_plots,
    (select count(*) from public.seed_orders) as visible_seed_orders,
    (select count(*) from public.inspections) as visible_inspections;
$$;
