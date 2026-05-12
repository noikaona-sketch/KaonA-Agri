-- Migration: invite PIN columns + member extras
-- เพิ่ม columns สำหรับระบบ PIN invite และข้อมูลเพิ่มเติมของสมาชิก

-- registration_type: บอกว่าสมัครเองหรือถูกเชิญ
alter table public.members
  add column if not exists address text,
  add column if not exists registration_type text not null default 'self'
    check (registration_type in ('self', 'invite', 'admin_created')),
  add column if not exists invite_pin text,
  add column if not exists invite_pin_expires timestamptz,
  add column if not exists invite_pin_used_at timestamptz,
  add column if not exists invite_role text
    check (invite_role in ('inspector','staff','leader','truck_owner', null)),
  add column if not exists invited_by uuid references public.members(id);

-- index สำหรับค้นหา PIN เร็ว
create index if not exists idx_members_invite_pin
  on public.members(invite_pin)
  where invite_pin is not null;

-- function: สร้าง PIN 6 หลักที่ไม่ซ้ำและยังไม่หมดอายุ
create or replace function public.generate_invite_pin()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
  v_exists boolean;
  v_attempts int := 0;
begin
  loop
    v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');

    select exists(
      select 1 from public.members
      where invite_pin = v_pin
        and invite_pin_expires > now()
        and invite_pin_used_at is null
    ) into v_exists;

    exit when not v_exists;

    v_attempts := v_attempts + 1;
    if v_attempts > 20 then
      raise exception 'Could not generate unique PIN after 20 attempts';
    end if;
  end loop;

  return v_pin;
end;
$$;

-- function: staff/admin สร้าง invite PIN ให้สมาชิก
-- p_member_id: สมาชิกที่จะได้รับ PIN (ต้องมี record อยู่แล้ว)
-- p_role: role ที่จะได้รับเมื่อใช้ PIN
-- p_hours: อายุ PIN เป็นชั่วโมง (default 24)
create or replace function public.create_member_invite_pin(
  p_member_id uuid,
  p_role text,
  p_hours int default 24
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_pin text;
begin
  -- ตรวจสอบว่า caller มีสิทธิ์ (staff หรือ admin)
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

  if p_role not in ('inspector','staff','leader','truck_owner') then
    raise exception 'invalid invite role: %', p_role;
  end if;

  v_pin := public.generate_invite_pin();

  update public.members
  set
    invite_pin         = v_pin,
    invite_pin_expires = now() + (p_hours || ' hours')::interval,
    invite_pin_used_at = null,
    invite_role        = p_role,
    invited_by         = v_caller_id,
    updated_at         = now()
  where id = p_member_id;

  return v_pin;
end;
$$;

grant execute on function public.generate_invite_pin() to authenticated;
grant execute on function public.create_member_invite_pin(uuid, text, int) to authenticated;

-- function: สมาชิกใช้ PIN เพื่อรับ role อัตโนมัติ
create or replace function public.redeem_invite_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_target_id uuid;
  v_role text;
begin
  select m.id into v_caller_id
  from public.members m
  where m.auth_user_id = auth.uid();

  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  -- หา member ที่มี PIN นี้ยังไม่หมดอายุและยังไม่ถูกใช้
  select id, invite_role
  into v_target_id, v_role
  from public.members
  where invite_pin = p_pin
    and invite_pin_expires > now()
    and invite_pin_used_at is null
  limit 1;

  if v_target_id is null then
    raise exception 'PIN ไม่ถูกต้องหรือหมดอายุแล้ว';
  end if;

  -- mark PIN ว่าใช้แล้ว
  update public.members
  set invite_pin_used_at = now(),
      updated_at = now()
  where id = v_target_id;

  -- เพิ่ม role ให้ caller
  insert into public.member_roles (member_id, role, is_primary)
  values (v_caller_id, v_role, false)
  on conflict (member_id, role) do nothing;

  -- อนุมัติสมาชิกทันที (ไม่ต้องรอ)
  update public.members
  set status = 'approved', updated_at = now()
  where id = v_caller_id;

  return jsonb_build_object('role', v_role, 'approved', true);
end;
$$;

grant execute on function public.redeem_invite_pin(text) to authenticated;
