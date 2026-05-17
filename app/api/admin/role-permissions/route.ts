// GET: ดึง permission matrix ทั้งหมด (super_admin only)
// POST: แก้ไข permission ของ role (super_admin only)

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

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
    const body = (await request.json()) as {
      admin_role: string;
      permission: string;
      granted: boolean;
    };
    if (!body.admin_role || !body.permission)
      return NextResponse.json({ error: 'admin_role และ permission จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();
    const { error } = await s.from('admin_role_permissions').upsert({
      admin_role:  body.admin_role,
      permission:  body.permission,
      granted:     body.granted,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'admin_role,permission' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
