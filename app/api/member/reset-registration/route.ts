import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// POST — reset สมาชิกที่ถูกยกเลิก กลับเป็น pending เพื่อสมัครใหม่
export async function POST(request: Request) {
  try {
    const { member_id } = (await request.json()) as { member_id: string };
    if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ตรวจว่าเป็น cancelled_by_admin จริง
    const { data: member } = await s.from('members')
      .select('id, rejection_reason, status')
      .eq('id', member_id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
    if (member.rejection_reason !== 'cancelled_by_admin')
      return NextResponse.json({ error: 'ไม่สามารถรีเซ็ตได้' }, { status: 403 });

    // รีเซ็ตกลับเป็น pending
    const { error } = await s.from('members').update({
      status:           'pending',
      rejection_reason: null,
      updated_at:       new Date().toISOString(),
    }).eq('id', member_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // สร้าง approval ใหม่
    await s.from('approvals').insert({
      member_id,
      resource_type: 'member',
      status:        'pending',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
