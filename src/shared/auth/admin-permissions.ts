// ─────────────────────────────────────────────────────────────────────
// Admin Permission Model — centralized config
// PR2: Foundation only. Menu hiding (PR3) and API enforcement (PR4) next.
// ─────────────────────────────────────────────────────────────────────

export type AdminRole =
  | 'super_admin'
  | 'member_admin'
  | 'field_admin'
  | 'market_admin'
  | 'service_admin'
  | 'seed_admin'
  | 'finance_admin'
  | 'readonly_admin';

export type AdminPermission =
  | 'members.read'
  | 'members.write'
  | 'members.approve'
  | 'members.import'
  | 'market_prices.read'
  | 'market_prices.write'
  | 'field.read'
  | 'field.write'
  | 'service.read'
  | 'service.write'
  | 'seed.read'
  | 'seed.write'
  | 'finance.read'
  | 'finance.write'
  | 'reports.read'
  | 'admin_users.manage';

// All permission keys — used for matrix UI
export const ALL_PERMISSIONS: AdminPermission[] = [
  'members.read', 'members.write', 'members.approve', 'members.import',
  'market_prices.read', 'market_prices.write',
  'field.read', 'field.write',
  'service.read', 'service.write',
  'seed.read', 'seed.write',
  'finance.read', 'finance.write',
  'reports.read', 'admin_users.manage',
];

// Default role → permissions (used as fallback when DB not available)
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  member_admin: [
    'members.read', 'members.write', 'members.approve', 'members.import',
  ],
  field_admin: [
    'field.read', 'field.write', 'members.read',
  ],
  market_admin: [
    'market_prices.read', 'market_prices.write',
  ],
  service_admin: [
    'service.read', 'service.write', 'members.read',
  ],
  seed_admin: [
    'seed.read', 'seed.write', 'members.read',
  ],
  finance_admin: [
    'finance.read', 'finance.write', 'members.read',
  ],
  readonly_admin: [
    'reports.read', 'members.read', 'market_prices.read',
    'field.read', 'service.read', 'seed.read', 'finance.read',
  ],
};

// Department → admin_role fallback mapping (backward compat only)
const DEPARTMENT_ROLE_MAP: Record<string, AdminRole> = {
  admin:      'super_admin',
  sales:      'service_admin',
  accounting: 'finance_admin',
  finance:    'finance_admin',
  field:      'field_admin',
  stock:      'seed_admin',
  // new department names (when admin sets them)
  member:     'member_admin',
  market:     'market_admin',
  service:    'service_admin',
  seed:       'seed_admin',
};

export function departmentToRole(department: string | null): AdminRole {
  if (!department) return 'readonly_admin';
  return DEPARTMENT_ROLE_MAP[department.toLowerCase()] ?? 'readonly_admin';
}

export function hasPermission(
  permissions: AdminPermission[],
  key: AdminPermission,
): boolean {
  return permissions.includes(key);
}

export function isReadOnly(permissions: AdminPermission[]): boolean {
  const writeKeys: AdminPermission[] = [
    'members.write', 'members.approve', 'members.import',
    'market_prices.write', 'field.write', 'service.write',
    'seed.write', 'finance.write', 'admin_users.manage',
  ];
  return !writeKeys.some((k) => permissions.includes(k));
}
