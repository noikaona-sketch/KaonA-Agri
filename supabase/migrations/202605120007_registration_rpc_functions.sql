-- Migration: RPC functions สำหรับการสมัครสมาชิกแบบเต็ม
-- farmer: สมัคร + แปลงหลายแปลง + เอกสาร
-- truck_owner: สมัคร + รถหลายคัน + เอกสาร

-- function: สมัครสมาชิก farmer พร้อมข้อมูลครบ
create or replace function public.submit_farmer_registration(
  p_line_user_id text,
  p_full_name text,
  p_phone text,
  p_citizen_id_masked text,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  if coalesce(trim(p_line_user_id), '') = '' then
    raise exception 'line_user_id is required';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'full_name is required';
  end if;
  if coalesce(trim(p_citizen_id_masked), '') = '' then
    raise exception 'citizen_id_masked is required';
  end if;

  -- หา member จาก line_user_id
  select id into v_member_id
  from public.members
  where line_user_id = p_line_user_id
  limit 1;

  if v_member_id is null then
    raise exception 'member not found for line_user_id';
  end if;

  -- อัปเดตข้อมูล
  update public.members
  set
    full_name          = p_full_name,
    phone              = p_phone,
    citizen_id_masked  = p_citizen_id_masked,
    address            = p_address,
    status             = 'pending',
    registration_type  = 'self',
    updated_at         = now()
  where id = v_member_id;

  -- ตั้ง role เป็น farmer ถ้ายังไม่มี
  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, 'farmer', true)
  on conflict (member_id, role) do nothing;

  -- สร้าง approval request
  insert into public.approvals (member_id, requested_by, resource_type, resource_id, status, note)
  values (v_member_id, v_member_id, 'member', v_member_id, 'pending', 'Farmer registration')
  on conflict do nothing;

  return v_member_id;
end;
$$;

grant execute on function public.submit_farmer_registration(text, text, text, text, text) to authenticated;

-- function: เพิ่มแปลงในการสมัคร (เรียกได้หลายครั้ง)
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
  v_auth_member_id uuid;
begin
  select id into v_auth_member_id
  from public.members
  where auth_user_id = auth.uid();

  if v_auth_member_id is null or v_auth_member_id <> p_member_id then
    raise exception 'Cannot add plot for another member';
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

-- function: สมัครสมาชิก truck_owner พร้อมข้อมูลครบ
create or replace function public.submit_truck_registration(
  p_line_user_id text,
  p_full_name text,
  p_phone text,
  p_citizen_id_masked text,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select id into v_member_id
  from public.members
  where line_user_id = p_line_user_id
  limit 1;

  if v_member_id is null then
    raise exception 'member not found for line_user_id';
  end if;

  update public.members
  set
    full_name         = p_full_name,
    phone             = p_phone,
    citizen_id_masked = p_citizen_id_masked,
    address           = p_address,
    status            = 'pending',
    registration_type = 'self',
    updated_at        = now()
  where id = v_member_id;

  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, 'truck_owner', true)
  on conflict (member_id, role) do nothing;

  insert into public.approvals (member_id, requested_by, resource_type, resource_id, status, note)
  values (v_member_id, v_member_id, 'member', v_member_id, 'pending', 'Truck owner registration')
  on conflict do nothing;

  return v_member_id;
end;
$$;

grant execute on function public.submit_truck_registration(text, text, text, text, text) to authenticated;

-- function: เพิ่มรถในการสมัคร (เรียกได้หลายครั้ง)
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
  v_auth_member_id uuid;
begin
  select id into v_auth_member_id
  from public.members
  where auth_user_id = auth.uid();

  if v_auth_member_id is null or v_auth_member_id <> p_member_id then
    raise exception 'Cannot add vehicle for another member';
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
