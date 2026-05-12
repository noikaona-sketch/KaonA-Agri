-- Migration: admin_users table + departments + สิทธิ์เมนูหลังบ้าน

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  department text not null check (department in (
    'super_admin',
    'admin',
    'sales',
    'accounting',
    'finance',
    'field',
    'stock'
  )),
  status text not null default 'pending'
    check (status in ('pending','approved','suspended')),
  auth_user_id uuid unique,
  approved_by uuid references public.admin_users(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- สิทธิ์เมนูแต่ละแผนก
create table if not exists public.admin_department_permissions (
  department text primary key,
  can_approve_members boolean not null default false,
  can_manage_roles boolean not null default false,
  can_manage_groups boolean not null default false,
  can_create_pin boolean not null default false,
  can_view_members boolean not null default false,
  can_manage_accounting boolean not null default false,
  can_manage_stock boolean not null default false
);

-- seed สิทธิ์ตามแผนก
insert into public.admin_department_permissions values
  ('super_admin', true,  true,  true,  true,  true,  true,  true),
  ('admin',       true,  true,  true,  true,  true,  true,  true),
  ('sales',       false, false, false, false, true,  false, false),
  ('accounting',  false, false, false, false, true,  true,  false),
  ('finance',     false, false, false, false, true,  true,  false),
  ('field',       true,  false, true,  true,  true,  false, false),
  ('stock',       false, false, false, false, true,  false, true)
on conflict (department) do update set
  can_approve_members   = excluded.can_approve_members,
  can_manage_roles      = excluded.can_manage_roles,
  can_manage_groups     = excluded.can_manage_groups,
  can_create_pin        = excluded.can_create_pin,
  can_view_members      = excluded.can_view_members,
  can_manage_accounting = excluded.can_manage_accounting,
  can_manage_stock      = excluded.can_manage_stock;

-- updated_at trigger
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

-- index
create index if not exists idx_admin_users_department
  on public.admin_users(department);
create index if not exists idx_admin_users_status
  on public.admin_users(status);

-- RLS
alter table public.admin_users enable row level security;
alter table public.admin_department_permissions enable row level security;

-- admin_users: อ่านได้เฉพาะ super_admin/admin
create policy admin_users_select_admin_only
on public.admin_users for select
using (
  exists (
    select 1 from public.admin_users au
    where au.auth_user_id = auth.uid()
      and au.status = 'approved'
      and au.department in ('super_admin','admin')
  )
  or auth_user_id = auth.uid()
);

-- admin_users: insert เปิดกว้าง (สมัครได้ทุกคน)
create policy admin_users_insert_open
on public.admin_users for insert
with check (true);

-- admin_users: update เฉพาะ super_admin/admin หรือตัวเอง
create policy admin_users_update_admin_or_self
on public.admin_users for update
using (
  exists (
    select 1 from public.admin_users au
    where au.auth_user_id = auth.uid()
      and au.status = 'approved'
      and au.department in ('super_admin','admin')
  )
  or auth_user_id = auth.uid()
);

-- department_permissions: อ่านได้ทุกคนที่ approved
create policy dept_permissions_select_approved
on public.admin_department_permissions for select
using (
  exists (
    select 1 from public.admin_users au
    where au.auth_user_id = auth.uid()
      and au.status = 'approved'
  )
);

-- function: ดึงสิทธิ์ของ admin user ปัจจุบัน
create or replace function public.get_my_admin_permissions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select row_to_json(p)::jsonb
  from public.admin_users au
  join public.admin_department_permissions p on p.department = au.department
  where au.auth_user_id = auth.uid()
    and au.status = 'approved'
  limit 1;
$$;

grant execute on function public.get_my_admin_permissions() to authenticated;
