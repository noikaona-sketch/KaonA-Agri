import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

// GET /api/admin/members/approvals — ดึงคิวอนุมัติ
export async function GET() {
  try {
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('approvals')
      .select(`
        id,
        member_id,
        status,
        created_at,
        members!inner (
          id, full_name, phone, citizen_id_masked, status,
          registration_type, address, created_at
        )
      `)
      .eq('resource_type', 'member')
      .eq('status', 'pending')
      .eq('members.status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/members/approvals — อนุมัติ/ปฏิเสธ
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId?: string;
      approvalId?: string;
      decision?: 'approved' | 'rejected' | 'suspended' | 'pending';
    };

    if (!body.memberId || !body.decision) {
      return NextResponse.json({ error: 'memberId and decision required' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    // update member status
    const { error: memberErr } = await s
      .from('members')
      .update({ status: body.decision, updated_at: new Date().toISOString() })
      .eq('id', body.memberId);

    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    // update approval record
    if (body.approvalId) {
      await s.from('approvals')
        .update({ status: body.decision, updated_at: new Date().toISOString() })
        .eq('id', body.approvalId);
    } else {
      await s.from('approvals')
        .update({ status: body.decision, updated_at: new Date().toISOString() })
        .eq('member_id', body.memberId)
        .eq('status', 'pending');
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
