// Admin server-side auth + permission helper
// PR2: Extended to return role + permissions
// Used by all admin API routes

import { cookies }    from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import {
  AdminRole,
  AdminPermission,
  ROLE_DEFAULT_PERMISSIONS,
  departmentToRole,
  hasPermission,
} from '@/shared/auth/admin-permissions';

const VALID_ADMIN_COOKIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^env-super-admin$/i;
const ADMIN_COOKIE_NAME  = 'kaona_admin_web';

export type AdminActor = {
  adminUserId:  string;
  email:        string | null;
  department:   string | null;
  adminRole:    AdminRole;
  permissions:  AdminPermission[];
};

// ── Load permissions from DB (falls back to config defaults) ──────────
async function loadPermissions(adminRole: AdminRole): Promise<AdminPermission[]> {
  // super_admin always gets everything
  if (adminRole === 'super_admin') return [...ROLE_DEFAULT_PERMISSIONS.super_admin];

  try {
    const s = createServerSupabaseClient();
    const { data } = await s
      .from('admin_role_permissions')
      .select('permission, granted')
      .eq('admin_role', adminRole)
      .eq('granted', true);

    if (data && data.length > 0) {
      return (data as { permission: string }[])
        .map((r) => r.permission as AdminPermission);
    }
  } catch {
    // DB not available — fallback to config
  }
  return [...(ROLE_DEFAULT_PERMISSIONS[adminRole] ?? [])];
}

// ── Main: requireAdmin ────────────────────────────────────────────────
export async function requireAdmin(): Promise<AdminActor | null> {
  try {
    const cookieStore = await cookies();
    const cookieVal   = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? '';
    if (!VALID_ADMIN_COOKIE.test(cookieVal)) return null;

    // env-super-admin (dev/emergency)
    if (cookieVal === 'env-super-admin') {
      const permissions = await loadPermissions('super_admin');
      return {
        adminUserId: 'env-super-admin',
        email:       'super@kaona.app',
        department:  'admin',
        adminRole:   'super_admin',
        permissions,
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
    const d = data as { id: string; email: string | null; department: string | null; admin_role: string | null };

    // Resolve adminRole:
    // 1. admin_role column (new)
    // 2. department fallback (legacy compat)
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

// ── requireAdminPermission — server-side permission check ─────────────
// Usage: const admin = await requireAdminPermission('members.approve');
// Returns NextResponse 403 if not allowed, null if allowed (check result)
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
        { error: `ไม่มีสิทธิ์สำหรับ ${permissionKey}`, requiredPermission: permissionKey },
        { status: 403 },
      ),
    };
  }
  return { admin };
}

// ── isForbidden — type guard helper ───────────────────────────────────
// Usage:
//   const result = await requireAdminPermission('members.approve');
//   if (isForbidden(result)) return result.forbidden;
//   const { admin } = result;
export function isForbidden(
  result: { forbidden: NextResponse } | { admin: AdminActor },
): result is { forbidden: NextResponse } {
  return 'forbidden' in result;
}
