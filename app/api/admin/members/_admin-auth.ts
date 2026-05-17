// Admin server-side auth + permission helper
// Usage examples:
//
// Pattern A — simple admin check:
//   const admin = await requireAdmin();
//   if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
//
// Pattern B — permission check (recommended for mutations):
//   const result = await requireAdminPermission('members.approve');
//   if (isForbidden(result)) return result.forbidden;
//   const { admin } = result;
//   // admin.adminRole, admin.permissions available here
//
// Pattern C — check inside handler:
//   const admin = await requireAdmin();
//   if (!admin || !hasPermission(admin.permissions, 'market_prices.write'))
//     return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });

import { cookies }     from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import {
  AdminRole,
  AdminPermission,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  departmentToRole,
  hasPermission,
} from '@/shared/auth/admin-permissions';

const VALID_ADMIN_COOKIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^env-super-admin$/i;
const ADMIN_COOKIE_NAME  = 'kaona_admin_web';

// Minimal safe permissions for fail-closed behavior
const FAIL_CLOSED_PERMISSIONS: AdminPermission[] = [
  'members.read', 'market_prices.read', 'field.read',
  'service.read', 'seed.read', 'finance.read', 'reports.read',
];

export type AdminActor = {
  adminUserId:  string;
  email:        string | null;
  department:   string | null;
  adminRole:    AdminRole;
  permissions:  AdminPermission[];
};

// ── loadPermissions ───────────────────────────────────────────────────
// Blocker 2: fail closed on DB error for non-super_admin
async function loadPermissions(adminRole: AdminRole): Promise<AdminPermission[]> {
  // super_admin always gets everything — bypasses DB
  if (adminRole === 'super_admin') return [...ALL_PERMISSIONS];

  try {
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('admin_role_permissions')
      .select('permission, granted')
      .eq('admin_role', adminRole)
      .eq('granted', true);

    if (error) {
      // DB query failed → fail closed: return read-only minimal set
      // Do NOT fall back to default write permissions on error
      console.error('[admin-auth] loadPermissions DB error — failing closed:', error.message);
      return FAIL_CLOSED_PERMISSIONS;
    }

    if (data && data.length > 0) {
      // DB returned rows → use DB as source of truth
      return (data as { permission: string }[])
        .map((r) => r.permission as AdminPermission);
    }

    // DB returned zero rows → role not yet configured
    // Fall back to config defaults (backward compat for new installs)
    return [...(ROLE_DEFAULT_PERMISSIONS[adminRole] ?? FAIL_CLOSED_PERMISSIONS)];
  } catch (e) {
    // Unexpected error → fail closed
    console.error('[admin-auth] loadPermissions unexpected error — failing closed:', e);
    return FAIL_CLOSED_PERMISSIONS;
  }
}

// ── requireAdmin ──────────────────────────────────────────────────────
export async function requireAdmin(): Promise<AdminActor | null> {
  try {
    const cookieStore = await cookies();
    const cookieVal   = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? '';
    if (!VALID_ADMIN_COOKIE.test(cookieVal)) return null;

    // env-super-admin (dev/emergency) → super_admin
    if (cookieVal === 'env-super-admin') {
      return {
        adminUserId: 'env-super-admin',
        email:       'super@kaona.app',
        department:  'admin',
        adminRole:   'super_admin',
        permissions: [...ALL_PERMISSIONS],
      };
    }

    // lookup admin_users
    const s = createServerSupabaseClient();
    const { data } = await s.from('admin_users')
      .select('id,email,status,department,admin_role')
      .eq('id', cookieVal)
      .eq('status', 'approved')
      .maybeSingle();

    if (!data) return null;
    const d = data as {
      id: string; email: string | null;
      department: string | null; admin_role: string | null;
    };

    // Resolve adminRole (priority order):
    // 1. admin_role column (new — explicit permission role)
    // 2. department fallback (legacy compat only)
    // 3. readonly_admin (safest default)
    const adminRole: AdminRole =
      (d.admin_role as AdminRole | null) ??
      departmentToRole(d.department);

    const permissions = await loadPermissions(adminRole);
    return {
      adminUserId: d.id,
      email:       d.email,
      department:  d.department,
      adminRole,
      permissions,
    };
  } catch {
    return null;
  }
}

// ── requireAdminPermission ────────────────────────────────────────────
// Checks both: is admin logged in + has specific permission
// Returns {admin} if allowed, {forbidden: NextResponse} if not
//
// Usage:
//   const result = await requireAdminPermission('members.approve');
//   if (isForbidden(result)) return result.forbidden;
//   const { admin } = result;
//   // proceed with admin.adminUserId, admin.email etc.
export async function requireAdminPermission(
  permissionKey: AdminPermission,
): Promise<{ forbidden: NextResponse } | { admin: AdminActor }> {
  const admin = await requireAdmin();
  if (!admin) {
    return {
      forbidden: NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาเข้าสู่ระบบ admin' },
        { status: 403 },
      ),
    };
  }
  if (!hasPermission(admin.permissions, permissionKey)) {
    return {
      forbidden: NextResponse.json(
        {
          error: `ไม่มีสิทธิ์สำหรับการดำเนินการนี้`,
          requiredPermission: permissionKey,
          adminRole: admin.adminRole,
        },
        { status: 403 },
      ),
    };
  }
  return { admin };
}

// ── isForbidden ───────────────────────────────────────────────────────
// Type guard — use with requireAdminPermission()
//
// Usage:
//   if (isForbidden(result)) return result.forbidden;
export function isForbidden(
  result: { forbidden: NextResponse } | { admin: AdminActor },
): result is { forbidden: NextResponse } {
  return 'forbidden' in result;
}
