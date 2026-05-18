import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../../../members/_admin-auth';

type Params = { params: { id: string } };

// POST — เพิ่มหรือลบ role
export async function POST(req: Request, { params }: Params) {
  try {
    const _ar_post = await requireAdminPermission('admin_users.manage');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await req.json()) as {
      action: 'add' | 'remove' | 'set_primary';
      role: string;
    };
    const s = createServerSupabaseClient();
    const memberId = params.id;

    if (body.action === 'add') {
      const { error } = await s.from('member_roles')
        .upsert({ member_id: memberId, role: body.role, is_primary: false },
          { onConflict: 'member_id,role' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'remove') {
      // ตรวจว่ายังมี role อื่นเหลือ
      const { data: existing } = await s.from('member_roles')
        .select('role').eq('member_id', memberId);
      if ((existing ?? []).length <= 1) {
        return NextResponse.json({ error: 'ไม่สามารถลบ role สุดท้ายได้' }, { status: 400 });
      }
      const { error } = await s.from('member_roles')
        .delete().eq('member_id', memberId).eq('role', body.role);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.action === 'set_primary') {
      await s.from('member_roles')
        .update({ is_primary: false }).eq('member_id', memberId);
      await s.from('member_roles')
        .update({ is_primary: true }).eq('member_id', memberId).eq('role', body.role);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
