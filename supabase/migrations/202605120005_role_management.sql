-- Migration: แก้ invite_role constraint ให้ครอบคลุมทุก role
-- และเพิ่ม functions สำหรับจัดการ role สมาชิกในหลังบ้าน

-- แก้ constraint ให้รองรับทุก role รวมถึง admin
alter table public.members
  drop constraint if exists members_invite_role_check;

alter table public.members
  add constraint members_invite_role_check
  check (invite_role in ('farmer','truck_owner','inspector','staff','leader','admin', null));

-- function: admin ดึงรายชื่อสมาชิกทั้งหมดพร้อม roles
create or replace function public.list_members_with_roles(
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  member_id uuid,
  full_name text,
  phone text,
  citizen_id_masked text,
  status text,
  registration_type text,
  roles text[],
  effective_role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as member_id,
    m.full_name,
    m.phone,
    m.citizen_id_masked,
    m.status,
    m.registration_type,
    coalesce(
      array_agg(mr.role order by mr.is_primary desc, mr.created_at)
      filter (where mr.role is not null),
      array[]::text[]
    ) as roles,
    (
      select mr2.role from public.member_roles mr2
      where mr2.member_id = m.id
        and mr2.role <> 'service_account'
      order by mr2.is_primary desc, public.role_priority(mr2.role)
      limit 1
    ) as effective_role,
    m.created_at
  from public.members m
  left join public.member_roles mr on mr.member_id = m.id
  where m.deleted_at is null
    and (p_status is null or m.status = p_status)
  group by m.id
  order by m.created_at desc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.list_members_with_roles(text, int, int) to authenticated;

-- function: admin เพิ่ม role ให้สมาชิก
create or replace function public.admin_add_member_role(
  p_member_id uuid,
  p_role text,
  p_is_primary boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
begin
  select m.id into v_caller_id
  from public.members m
  where m.auth_user_id = auth.uid();

  if not exists (
    select 1 from public.member_roles
    where member_id = v_caller_id
      and role in ('admin','staff')
  ) then
    raise exception 'admin or staff role required';
  end if;

  if p_role not in ('farmer','truck_owner','inspector','staff','leader','admin') then
    raise exception 'invalid role: %', p_role;
  end if;

  insert into public.member_roles (member_id, role, is_primary)
  values (p_member_id, p_role, p_is_primary)
  on conflict (member_id, role) do update
    set is_primary = excluded.is_primary;
end;
$$;

grant execute on function public.admin_add_member_role(uuid, text, boolean) to authenticated;

-- function: admin ลบ role จากสมาชิก
create or replace function public.admin_remove_member_role(
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_remaining int;
begin
  select m.id into v_caller_id
  from public.members m
  where m.auth_user_id = auth.uid();

  if not exists (
    select 1 from public.member_roles
    where member_id = v_caller_id
      and role in ('admin','staff')
  ) then
    raise exception 'admin or staff role required';
  end if;

  select count(*) into v_remaining
  from public.member_roles
  where member_id = p_member_id;

  if v_remaining <= 1 then
    raise exception 'ไม่สามารถลบ role สุดท้ายได้';
  end if;

  delete from public.member_roles
  where member_id = p_member_id and role = p_role;
end;
$$;

grant execute on function public.admin_remove_member_role(uuid, text) to authenticated;
