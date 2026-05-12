-- Migration: รองรับ admin_created members (เส้นที่ 4)
-- admin สร้าง member record ก่อน แล้ว member ใช้ PIN ผูก LINE ทีหลัง

-- line_user_id เดิม NOT NULL — เปลี่ยนให้ nullable สำหรับ admin_created
alter table public.members
  alter column line_user_id drop not null;

-- unique constraint ยังคงอยู่ แต่ต้องรองรับ null หลายแถว
-- drop constraint เดิมแล้วสร้างใหม่แบบ partial
alter table public.members
  drop constraint if exists members_line_user_id_key;

create unique index if not exists uq_members_line_user_id_not_null
  on public.members(line_user_id)
  where line_user_id is not null;

-- เพิ่ม column registration_source เพื่อแยก admin_created ชัดขึ้น
-- (registration_type มีอยู่แล้วจาก migration 202605120001)

-- function: admin สร้าง member record พร้อม PIN (ไม่มี line_user_id ก่อน)
create or replace function public.admin_create_member_with_pin(
  p_full_name text,
  p_phone text,
  p_citizen_id_masked text,
  p_role text default 'farmer',
  p_hours int default 72
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_member_id uuid;
  v_pin text;
begin
  -- ตรวจสอบ caller มีสิทธิ์ (admin/staff)
  select m.id into v_caller_id
  from public.members m
  where m.auth_user_id = auth.uid();

  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  select mr.role into v_caller_role
  from public.member_roles mr
  where mr.member_id = v_caller_id
    and mr.role in ('admin','staff')
  order by case when mr.role = 'admin' then 0 else 1 end
  limit 1;

  if v_caller_role is null then
    raise exception 'admin or staff role required';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'full_name is required';
  end if;

  -- สร้าง PIN
  v_pin := public.generate_invite_pin();

  -- สร้าง member record (ไม่มี line_user_id ก่อน)
  insert into public.members (
    line_user_id,
    full_name,
    phone,
    citizen_id_masked,
    status,
    registration_type,
    invite_pin,
    invite_pin_expires,
    invite_role,
    invited_by
  ) values (
    null,
    p_full_name,
    p_phone,
    coalesce(p_citizen_id_masked, 'PENDING'),
    'pending',
    'admin_created',
    v_pin,
    now() + (p_hours || ' hours')::interval,
    p_role,
    v_caller_id
  )
  returning id into v_member_id;

  -- เพิ่ม role ล่วงหน้า
  insert into public.member_roles (member_id, role, is_primary)
  values (v_member_id, p_role, true)
  on conflict (member_id, role) do nothing;

  return jsonb_build_object(
    'member_id', v_member_id,
    'pin', v_pin,
    'role', p_role,
    'expires_hours', p_hours
  );
end;
$$;

grant execute on function public.admin_create_member_with_pin(text, text, text, text, int) to authenticated;

-- function: สมาชิกกรอก PIN เพื่อผูก line_user_id (เส้น 4)
create or replace function public.link_line_with_pin(
  p_line_user_id text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_role text;
begin
  if coalesce(trim(p_line_user_id), '') = '' then
    raise exception 'line_user_id is required';
  end if;

  if p_pin !~ '^\d{6}$' then
    raise exception 'PIN ต้องเป็นตัวเลข 6 หลัก';
  end if;

  -- หา admin_created record ที่มี PIN นี้
  select id, invite_role
  into v_member_id, v_role
  from public.members
  where invite_pin = p_pin
    and invite_pin_expires > now()
    and invite_pin_used_at is null
    and registration_type = 'admin_created'
    and line_user_id is null
  limit 1;

  if v_member_id is null then
    raise exception 'PIN ไม่ถูกต้องหรือหมดอายุแล้ว';
  end if;

  -- ผูก line_user_id + mark PIN ว่าใช้แล้ว + approve
  update public.members
  set
    line_user_id       = p_line_user_id,
    invite_pin_used_at = now(),
    status             = 'approved',
    updated_at         = now()
  where id = v_member_id;

  return jsonb_build_object('member_id', v_member_id, 'role', v_role, 'approved', true);
end;
$$;

grant execute on function public.link_line_with_pin(text, text) to authenticated;
