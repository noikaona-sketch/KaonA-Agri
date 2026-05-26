import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../../members/_admin-auth';

type Params = { params: { id: string } };

// POST — เพิ่มสมาชิกเข้ากลุ่ม
export async function POST(request: Request, { params }: Params) {
  try {
    const _ar_post = await requireAdminPermission('members.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as { member_id: string };
    if (!body.member_id) {
      return NextResponse.json({ error: 'ต้องการ member_id' }, { status: 400 });
    }
    const s = createServerSupabaseClient();
    const { error } = await s.from('member_group_members').insert({
      group_id: params.id, member_id: body.member_id,
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'สมาชิกนี้อยู่ในกลุ่มแล้ว' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — ลบสมาชิกออกจากกลุ่ม
export async function DELETE(request: Request, { params }: Params) {
  try {
    const _ar_delete = await requireAdminPermission('members.write');
    if (isForbidden(_ar_delete)) return _ar_delete.forbidden;

    const body = (await request.json()) as { member_id: string };
    if (!body.member_id) {
      return NextResponse.json({ error: 'ต้องการ member_id' }, { status: 400 });
    }
    const s = createServerSupabaseClient();
    const { error } = await s.from('member_group_members')
      .delete().eq('group_id', params.id).eq('member_id', body.member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { member_id, is_leader } = (await request.json()) as { member_id: string; is_leader: boolean };
    const s = createServerSupabaseClient();
    const { error } = await s.from('member_group_members')
      .update({ is_leader })
      .eq('group_id', id).eq('member_id', member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // อัปเดต role ของ member ด้วย
    if (is_leader) {
      await s.from('member_roles').upsert({ member_id, role: 'leader', is_primary: false }, { onConflict: 'member_id,role' });
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
