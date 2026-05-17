import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

const ALLOWED_DECISIONS = ['approved','rejected','returned','suspended','pending'];

export async function GET() {
  try {
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('approvals')
      .select(`
        id, member_id, status, created_at,
        member:members!approvals_member_id_fkey (
          id, full_name, phone, citizen_id_masked, status,
          registration_type, address, created_at,
          bank_verified_status
        )
      `)
      .eq('resource_type', 'member').eq('status', 'pending')
      .order('created_at', { ascending: true }).limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId?:   string;
      approvalId?: string;
      decision?:   string;
      reason?:     string;
      bankStatus?: string;
    };

    if (!body.memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });
    const s = createServerSupabaseClient();

    // ── bank status update ──────────────────────────────────────────
    if (body.decision === 'bank_status') {
      const allowed = ['missing','needs_review','verified','rejected'];
      if (!body.bankStatus || !allowed.includes(body.bankStatus))
        return NextResponse.json({ error: 'bankStatus invalid' }, { status: 400 });

      const { error } = await s.from('members')
        .update({ bank_verified_status: body.bankStatus, updated_at: new Date().toISOString() })
        .eq('id', body.memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await s.from('member_approval_logs').insert({
        member_id: body.memberId, action: `bank_${body.bankStatus}`,
        reason: body.reason ?? null, acted_by: 'admin',
      });
      return NextResponse.json({ ok: true });
    }

    // ── member status update ────────────────────────────────────────
    if (!body.decision || !ALLOWED_DECISIONS.includes(body.decision))
      return NextResponse.json({ error: 'decision invalid' }, { status: 400 });

    // returned/rejected ต้องมี reason
    if (['returned','rejected'].includes(body.decision) && !body.reason?.trim())
      return NextResponse.json({ error: 'reason required for returned/rejected' }, { status: 400 });

    const updatePayload: Record<string, unknown> = {
      status: body.decision,
      updated_at: new Date().toISOString(),
    };
    if (body.decision === 'returned') {
      updatePayload.return_reason = body.reason;
      updatePayload.returned_at   = new Date().toISOString();
    }
    if (body.decision === 'rejected') {
      updatePayload.rejection_reason = body.reason;
      updatePayload.rejected_at      = new Date().toISOString();
    }

    const { error: memberErr } = await s.from('members')
      .update(updatePayload).eq('id', body.memberId);
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    // update approvals table
    const approvalUpdate = { status: body.decision, updated_at: new Date().toISOString() };
    if (body.approvalId) {
      await s.from('approvals').update(approvalUpdate).eq('id', body.approvalId);
    } else {
      await s.from('approvals').update(approvalUpdate)
        .eq('member_id', body.memberId).eq('status', 'pending');
    }

    // บันทึก log
    await s.from('member_approval_logs').insert({
      member_id: body.memberId, action: body.decision,
      reason: body.reason ?? null, acted_by: 'admin',
    });

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
