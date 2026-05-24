-- seed super_admin permissions ครบทุก permission
-- ใช้ on conflict do nothing เพื่อ idempotent

insert into public.admin_role_permissions (admin_role, permission, granted)
select 'super_admin', unnest(ARRAY[
  'members.read', 'members.write', 'members.approve', 'members.import',
  'market_prices.read', 'market_prices.write',
  'field.read', 'field.write',
  'service.read', 'service.write',
  'seed.read', 'seed.write',
  'finance.read', 'finance.write',
  'reports.read', 'harvest.read',
  'admin_users.manage'
]::text[]), true
on conflict (admin_role, permission) do update set granted = true;

-- อัปเดต department mapping ให้ super_admin เป็น role จริงๆ
update public.admin_users
  set admin_role = 'super_admin'
  where department = 'admin' and (admin_role is null or admin_role = '');
