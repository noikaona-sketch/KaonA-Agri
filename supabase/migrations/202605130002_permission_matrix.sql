-- Migration: Permission Matrix Concept
-- Extracted from K_farm adminPermissions.ts / permissions.ts
-- UI uses this for menu visibility ONLY
-- Real security stays in RLS + API route validation

-- ── 1. feature_catalog ────────────────────────────────────────────────
-- รายการ feature ทั้งหมดในระบบ
create table if not exists public.feature_catalog (
  id          text primary key,            -- 'member.view', 'seed.stock' ฯลฯ
  category    text not null,               -- 'member' | 'seed' | 'field' | 'report' ฯลฯ
  label_th    text not null,               -- ชื่อภาษาไทย
  description text,
  nav_path    text,                        -- /admin/xxx ถ้าเชื่อม nav
  is_active   boolean not null default true
);

-- seed data — extracted from K_farm DEPT_PERMISSIONS + ADMIN_MENUS
insert into public.feature_catalog (id, category, label_th, nav_path) values
  -- สมาชิก
  ('member.view',        'member', 'ดูรายชื่อสมาชิก',         '/admin/members'),
  ('member.approve',     'member', 'อนุมัติสมาชิก',           '/admin/members/approvals'),
  ('member.set_role',    'member', 'จัดการ Role สมาชิก',      '/admin/roles'),
  ('member.import',      'member', 'Import สมาชิก Excel',     null),
  -- เมล็ดพันธุ์
  ('seed.view',          'seed',   'ดูสินค้าเมล็ดพันธุ์',     '/admin/seeds'),
  ('seed.edit',          'seed',   'จัดการสินค้า/พันธุ์',     '/admin/products'),
  ('seed.supplier',      'seed',   'จัดการ Supplier',          '/admin/seed-suppliers'),
  ('seed.stock',         'seed',   'รับเข้า Stock เมล็ด',     '/admin/seed-lots'),
  ('seed.sales',         'seed',   'จอง/ขายเมล็ดพันธุ์',      '/admin/pos'),
  ('seed.debt',          'seed',   'ลูกหนี้เมล็ดพันธุ์',      '/admin/orders'),
  -- ราคา
  ('price.view',         'price',  'ดูราคากลาง',              '/admin/farming'),
  ('price.edit',         'price',  'แก้ไขราคากลาง',           '/admin/farming'),
  -- ตรวจแปลง
  ('inspection.view',    'field',  'ดูงานตรวจ',               '/admin/inspections'),
  ('inspection.edit',    'field',  'บันทึกผลตรวจ',            '/admin/inspections'),
  ('field.no_burn',      'field',  'งดเผา',                   '/admin/no-burn'),
  ('field.planting',     'field',  'วงจรเพาะปลูก',            '/admin/planting'),
  ('field.map',          'field',  'แผนที่แปลง',              '/admin/farming'),
  -- บริการ
  ('service.view',       'service','ดูการจองบริการ',          '/admin/service'),
  ('service.edit',       'service','จัดการการจองบริการ',       '/admin/service'),
  ('service.harvest',    'service','นัดรถเกี่ยว',              '/admin/harvest'),
  ('sale.appointment',   'sale',   'นัดขายผลผลิต',            '/admin/appointments'),
  -- รายงาน
  ('report.view',        'report', 'ดูรายงาน',                null),
  ('report.export',      'report', 'Export รายงาน',           null),
  -- ระบบ
  ('system.roles',       'system', 'กำหนดสิทธิ์',             '/admin/roles'),
  ('system.all',         'system', 'สิทธิ์ทั้งหมด',           null)
on conflict (id) do nothing;

-- ── 2. role_permissions ───────────────────────────────────────────────
-- mapping department → features ที่เข้าถึงได้
create table if not exists public.role_permissions (
  id          uuid primary key default gen_random_uuid(),
  department  text not null,
  feature_id  text not null references public.feature_catalog(id) on delete cascade,
  can_access  boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint uq_dept_feature unique (department, feature_id)
);

create index if not exists idx_role_permissions_dept on public.role_permissions(department);

-- seed data — แปลงจาก K_farm DEPT_PERMISSIONS
do $$
declare
  v_dept text;
  v_features text[];
  v_feat text;
begin
  -- super_admin / it: ทุก feature
  insert into public.role_permissions (department, feature_id)
  select 'super_admin', id from public.feature_catalog
  on conflict do nothing;

  -- admin: เหมือน super_admin ยกเว้น system.all
  insert into public.role_permissions (department, feature_id)
  select 'admin', id from public.feature_catalog where id != 'system.all'
  on conflict do nothing;

  -- field (agri ใน K_farm)
  foreach v_feat in array array['member.view','member.approve','seed.view','seed.supplier','inspection.view','inspection.edit','field.no_burn','field.planting','field.map','service.harvest','sale.appointment','report.view']
  loop
    insert into public.role_permissions (department, feature_id)
    values ('field', v_feat)
    on conflict do nothing;
  end loop;

  -- sales
  foreach v_feat in array array['member.view','price.view','price.edit','seed.view','seed.sales','seed.debt','sale.appointment','report.view','report.export']
  loop
    insert into public.role_permissions (department, feature_id)
    values ('sales', v_feat)
    on conflict do nothing;
  end loop;

  -- stock
  foreach v_feat in array array['seed.view','seed.edit','seed.supplier','seed.stock','seed.sales','seed.debt','service.view','report.view']
  loop
    insert into public.role_permissions (department, feature_id)
    values ('stock', v_feat)
    on conflict do nothing;
  end loop;

  -- accounting
  foreach v_feat in array array['member.view','price.view','seed.view','seed.debt','report.view','report.export']
  loop
    insert into public.role_permissions (department, feature_id)
    values ('accounting', v_feat)
    on conflict do nothing;
  end loop;

  -- finance
  foreach v_feat in array array['member.view','price.view','seed.debt','report.view','report.export']
  loop
    insert into public.role_permissions (department, feature_id)
    values ('finance', v_feat)
    on conflict do nothing;
  end loop;
end;
$$;

-- ── 3. function: get_department_nav ───────────────────────────────────
-- ดึงรายการ nav ที่แผนกนี้เข้าถึงได้
create or replace function public.get_department_nav(p_department text)
returns table (feature_id text, label_th text, nav_path text, category text)
language sql stable security definer set search_path = public
as $$
  select fc.id, fc.label_th, fc.nav_path, fc.category
  from public.feature_catalog fc
  join public.role_permissions rp
    on rp.feature_id = fc.id
    and rp.department = p_department
    and rp.can_access = true
  where fc.is_active = true
    and fc.nav_path is not null
  order by fc.category, fc.label_th;
$$;

grant execute on function public.get_department_nav(text) to authenticated;
grant execute on function public.get_department_nav(text) to service_role;

-- ── 4. RLS ────────────────────────────────────────────────────────────
alter table public.feature_catalog  enable row level security;
alter table public.role_permissions enable row level security;

-- ทุกคนอ่านได้ (UI ใช้ filter nav เท่านั้น — real security อยู่ที่ API/RLS)
create policy feature_catalog_read  on public.feature_catalog  for select using (true);
create policy role_permissions_read on public.role_permissions for select using (true);

-- แก้ไขได้เฉพาะ admin
create policy role_permissions_admin on public.role_permissions
  for all using (public.current_member_has_role('admin'));
