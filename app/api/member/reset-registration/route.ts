import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// POST — เตรียมสมาชิกที่ถูกยกเลิกให้กลับไปกรอกฟอร์มสมัครใหม่
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

    // ไม่เปลี่ยนเป็น pending ณ จุดนี้
    // เพื่อไม่ให้สมาชิกติดหน้า "รออนุมัติ" ก่อนส่งฟอร์มใหม่จริง
    const { error } = await s.from('members').update({
      updated_at: new Date().toISOString(),
    }).eq('id', member_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ลบ approval ที่ค้างอยู่เดิม (ถ้ามี)
    // หลีกเลี่ยงการปนกับสถานะ rejected จริง
    await s.from('approvals')
      .delete()
      .eq('member_id', member_id)
      .eq('resource_type', 'member')
      .eq('status', 'pending');

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
