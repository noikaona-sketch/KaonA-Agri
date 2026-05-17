import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';
import { ALL_PERMISSIONS, AdminRole, AdminPermission } from '@/shared/auth/admin-permissions';

const ALLOWED_ROLES: AdminRole[] = [
  'super_admin','member_admin','field_admin','market_admin',
  'service_admin','seed_admin','finance_admin','readonly_admin',
];

export async function GET() {
  const result = await requireAdminPermission('admin_users.manage');
  if (isForbidden(result)) return result.forbidden;
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('admin_role_permissions')
    .select('id,admin_role,permission,granted,updated_at')
    .order('admin_role').order('permission');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permissions: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireAdminPermission('admin_users.manage');
  if (isForbidden(result)) return result.forbidden;

  try {
    const body = (await request.json()) as { admin_role?: string; permission?: string; granted?: boolean };

    // Blocker 1: validate values
    if (!body.admin_role || !ALLOWED_ROLES.includes(body.admin_role as AdminRole))
      return NextResponse.json({ error: `admin_role ไม่ถูกต้อง — ต้องเป็น: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 });

    if (!body.permission || !(ALL_PERMISSIONS as string[]).includes(body.permission))
      return NextResponse.json({ error: `permission ไม่ถูกต้อง — ต้องเป็น: ${ALL_PERMISSIONS.join(', ')}` }, { status: 400 });

    // super_admin bypasses permission table — cannot be restricted via UI
    if (body.admin_role === 'super_admin')
      return NextResponse.json({ error: 'super_admin ไม่สามารถจำกัดสิทธิ์ได้' }, { status: 400 });

    if (typeof body.granted !== 'boolean')
      return NextResponse.json({ error: 'granted ต้องเป็น boolean' }, { status: 400 });

    const s = createServerSupabaseClient();
    const { error } = await s.from('admin_role_permissions').upsert({
      admin_role: body.admin_role,
      permission: body.permission as AdminPermission,
      granted:    body.granted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'admin_role,permission' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
