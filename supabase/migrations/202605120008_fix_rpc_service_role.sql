-- Migration: แก้ RPC functions ให้ server-side service role เรียกได้
-- ลบ auth.uid() check ออกจาก add_registration_plot และ add_registration_vehicle
-- เพราะ API routes ใช้ service role (bypass RLS) ไม่มี auth context

-- แก้ add_registration_plot — ลบ auth check, ใช้ p_member_id โดยตรง
create or replace function public.add_registration_plot(
  p_member_id uuid,
  p_name text,
  p_area_rai numeric,
  p_lat numeric,
  p_lng numeric,
  p_accuracy numeric default null,
  p_land_doc_type text default null,
  p_land_doc_number text default null,
  p_province text default null,
  p_district text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plot_id uuid;
begin
  if p_member_id is null then
    raise exception 'member_id is required';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'plot name is required';
  end if;

  if p_area_rai <= 0 then
    raise exception 'area_rai must be positive';
  end if;

  insert into public.plots (
    member_id, name, area_rai, lat, lng, accuracy,
    land_doc_type, land_doc_number, province, district, description,
    status, created_by, role_used, timestamp
  ) values (
    p_member_id, p_name, p_area_rai, p_lat, p_lng, p_accuracy,
    p_land_doc_type, p_land_doc_number, p_province, p_district, p_description,
    'pending_review', p_member_id, 'farmer', now()
  )
  returning id into v_plot_id;

  return v_plot_id;
end;
$$;

grant execute on function public.add_registration_plot(uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.add_registration_plot(uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, text) to service_role;

-- แก้ add_registration_vehicle — ลบ auth check, ใช้ p_member_id โดยตรง
create or replace function public.add_registration_vehicle(
  p_member_id uuid,
  p_vehicle_type text,
  p_plate_number text,
  p_brand text default null,
  p_model text default null,
  p_year_be integer default null,
  p_province text default null,
  p_capacity_ton numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  if p_member_id is null then
    raise exception 'member_id is required';
  end if;

  if coalesce(trim(p_plate_number), '') = '' then
    raise exception 'plate_number is required';
  end if;

  insert into public.member_vehicles (
    member_id, vehicle_type, plate_number, brand, model,
    year_be, province, capacity_ton, note
  ) values (
    p_member_id, p_vehicle_type, upper(trim(p_plate_number)),
    p_brand, p_model, p_year_be, p_province, p_capacity_ton, p_note
  )
  returning id into v_vehicle_id;

  return v_vehicle_id;
end;
$$;

grant execute on function public.add_registration_vehicle(uuid, text, text, text, text, integer, text, numeric, text) to authenticated;
grant execute on function public.add_registration_vehicle(uuid, text, text, text, text, integer, text, numeric, text) to service_role;

-- grant service_role สำหรับ submit functions ด้วย
grant execute on function public.submit_farmer_registration(text, text, text, text, text) to service_role;
grant execute on function public.submit_truck_registration(text, text, text, text, text) to service_role;
