import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

// GET — รายชื่อเจ้าหน้าที่ทั้งหมด
export async function GET() {
  try {
  const _ar_get = await requireAdminPermission('admin_users.manage');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('admin_users')
      .select('id, email, full_name, department, status, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ staff: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — อนุมัติ / ระงับ / ลบ
export async function POST(request: Request) {
  try {
  const _ar_post = await requireAdminPermission('admin_users.manage');
  if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as {
      action: 'approve' | 'suspend' | 'reactivate' | 'delete';
      admin_user_id: string;
    };

    if (!body.action || !body.admin_user_id) {
      return NextResponse.json({ error: 'action และ admin_user_id จำเป็น' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    if (body.action === 'approve') {
      const { error } = await s.from('admin_users')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', body.admin_user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'suspend') {
      const { error } = await s.from('admin_users')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', body.admin_user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'reactivate') {
      const { error } = await s.from('admin_users')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', body.admin_user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'delete') {
      // ดึง auth_user_id ก่อน
      const { data: row } = await s.from('admin_users')
        .select('auth_user_id').eq('id', body.admin_user_id).maybeSingle();
      const authId = (row as { auth_user_id: string } | null)?.auth_user_id;

      // ลบ admin_users record
      await s.from('admin_users').delete().eq('id', body.admin_user_id);

      // ลบ Auth user (ถ้ามี)
      if (authId) {
        await s.auth.admin.deleteUser(authId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
