import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';

type Params = { params: { id: string } };

// POST — เพิ่มสมาชิกเข้ากลุ่ม
export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json()) as { member_id: string; added_by: string };
    if (!body.member_id || !body.added_by) {
      return NextResponse.json({ error: 'ต้องการ member_id และ added_by' }, { status: 400 });
    }
    const s = createServerSupabaseClient();
    const { error } = await s.from('member_group_members').insert({
      group_id: params.id, member_id: body.member_id, added_by: body.added_by,
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
