import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// POST — ให้สมาชิกรีเซ็ตใบสมัครของตัวเองเพื่อสมัครใหม่
export async function POST(request: Request) {
  try {
    const { member_id } = (await request.json()) as { member_id: string };
    if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

    const s = createServerSupabaseClient();

    const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = token
      ? await s.auth.getUser(token)
      : await s.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    const { data: member } = await s.from('members')
      .select('id, rejection_reason, status')
      .eq('id', member_id)
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'ไม่สามารถรีเซ็ตสมาชิกนี้ได้' }, { status: 403 });

    const isCancelledByAdmin = member.status === 'rejected' && member.rejection_reason === 'cancelled_by_admin';
    const isPending = member.status === 'pending' || member.status === 'pending_approval';

    if (!isCancelledByAdmin && !isPending) {
      return NextResponse.json({ error: 'สถานะนี้ไม่สามารถเริ่มสมัครใหม่ได้' }, { status: 403 });
    }

    // ไม่เปลี่ยนสถานะทันที เพื่อไม่ให้ติดหน้า "รออนุมัติ" ก่อนเริ่มกรอกฟอร์มใหม่จริง
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
