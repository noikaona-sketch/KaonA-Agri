import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../_admin-auth';

const ALLOWED_DECISIONS = ['approved','rejected','returned','suspended','pending'];

export async function GET() {
  const auth = await requireAdminPermission('members.read');
  if (isForbidden(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('approvals')
      .select(`
        id, member_id, status, created_at,
        member:members!approvals_member_id_fkey (
          id, full_name, phone, citizen_id_masked, status,
          registration_type, address, created_at, bank_verified_status
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
    // ── Blocker 1: server-side admin validation ──────────────────────
    const adminAuth = await requireAdminPermission('members.approve');
    if (isForbidden(adminAuth)) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาเข้าสู่ระบบ admin' }, { status: 403 });
    }
    const { admin } = adminAuth;

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

      // Blocker 2: ใช้ admin identity จริง
      await s.from('member_approval_logs').insert({
        member_id:  body.memberId,
        action:     `bank_${body.bankStatus}`,
        reason:     body.reason ?? null,
        acted_by:   admin.email ?? admin.adminUserId,
      });
      return NextResponse.json({ ok: true });
    }

    // ── member status update ────────────────────────────────────────
    if (!body.decision || !ALLOWED_DECISIONS.includes(body.decision))
      return NextResponse.json({ error: 'decision invalid' }, { status: 400 });

    // returned/rejected ต้องมี reason (server-side enforced)
    if (['returned','rejected'].includes(body.decision) && !body.reason?.trim())
      return NextResponse.json({ error: 'กรุณาระบุเหตุผล' }, { status: 400 });

    // Blocker 4: completeness gate สำหรับ approved
    if (body.decision === 'approved') {
      const { data: m } = await s.from('members')
        .select('full_name,phone,subdistrict,district,province,citizen_id_masked,bank_verified_status')
        .eq('id', body.memberId).maybeSingle();

      if (m) {
        const mm = m as Record<string, string | null>;
        const incomplete = !mm.phone || !mm.subdistrict || !mm.district || !mm.province;
        const bankNotVerified = mm.bank_verified_status !== 'verified';

        if (incomplete || bankNotVerified) {
          // ต้องมี override reason ถ้าข้อมูลยังไม่ครบ
          if (!body.reason?.trim()) {
            const missing = [
              !mm.phone && 'เบอร์โทร',
              !mm.subdistrict && 'ตำบล',
              !mm.district && 'อำเภอ',
              !mm.province && 'จังหวัด',
              bankNotVerified && 'บัญชีธนาคารยังไม่ verified',
            ].filter(Boolean).join(', ');
            return NextResponse.json({
              error: `ข้อมูลยังไม่ครบ: ${missing}`,
              incomplete: true,
              missing_fields: missing,
            }, { status: 422 });
          }
          // มี override reason — อนุมัติได้แต่บันทึก override
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      status:     body.decision,
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

    const { error: memberErr } = await s.from('members').update(updatePayload).eq('id', body.memberId);
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    // update approvals table
    const approvalUpdate = { status: body.decision, updated_at: new Date().toISOString() };
    if (body.approvalId) {
      await s.from('approvals').update(approvalUpdate).eq('id', body.approvalId);
    } else {
      await s.from('approvals').update(approvalUpdate).eq('member_id', body.memberId).eq('status', 'pending');
    }

    // Blocker 2: log ด้วย admin identity จริง
    await s.from('member_approval_logs').insert({
      member_id:  body.memberId,
      action:     body.decision + (body.reason && body.decision === 'approved' ? '_with_override' : ''),
      reason:     body.reason ?? null,
      acted_by:   admin.email ?? admin.adminUserId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
