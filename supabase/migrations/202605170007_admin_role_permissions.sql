-- PR2: Admin role & permission foundation
-- Issue: Admin web permission model

-- ── 1. เพิ่ม admin_role column ใน admin_users ──────────────────────────
alter table public.admin_users
  add column if not exists admin_role text
    check (admin_role in (
      'super_admin','member_admin','field_admin','market_admin',
      'service_admin','seed_admin','finance_admin','readonly_admin'
    ));

comment on column public.admin_users.admin_role is
  'Permission role — แยกจาก department (org grouping). null = fallback จาก department';

-- ── 2. admin_role_permissions — DB-driven permission matrix ────────────
-- super_admin แก้ได้ผ่าน UI
create table if not exists public.admin_role_permissions (
  id          uuid primary key default gen_random_uuid(),
  admin_role  text not null,
  permission  text not null,
  granted     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (admin_role, permission)
);

comment on table public.admin_role_permissions is
  'Permission matrix per admin role. super_admin bypasses this table and cannot be restricted via UI.';

-- ── 3. seed default permissions ────────────────────────────────────────
insert into public.admin_role_permissions (admin_role, permission, granted) values
  -- member_admin
  ('member_admin', 'members.read',      true),
  ('member_admin', 'members.write',     true),
  ('member_admin', 'members.approve',   true),
  ('member_admin', 'members.import',    true),
  -- field_admin
  ('field_admin',  'field.read',        true),
  ('field_admin',  'field.write',       true),
  ('field_admin',  'members.read',      true),
  -- market_admin
  ('market_admin', 'market_prices.read',  true),
  ('market_admin', 'market_prices.write', true),
  -- service_admin
  ('service_admin','service.read',      true),
  ('service_admin','service.write',     true),
  ('service_admin','members.read',      true),
  -- seed_admin
  ('seed_admin',   'seed.read',         true),
  ('seed_admin',   'seed.write',        true),
  ('seed_admin',   'members.read',      true),
  -- finance_admin
  ('finance_admin','finance.read',      true),
  ('finance_admin','finance.write',     true),
  ('finance_admin','members.read',      true),
  -- readonly_admin
  ('readonly_admin','reports.read',        true),
  ('readonly_admin','members.read',        true),
  ('readonly_admin','market_prices.read',  true),
  ('readonly_admin','field.read',          true),
  ('readonly_admin','service.read',        true),
  ('readonly_admin','seed.read',           true),
  ('readonly_admin','finance.read',        true)
on conflict (admin_role, permission) do nothing;
