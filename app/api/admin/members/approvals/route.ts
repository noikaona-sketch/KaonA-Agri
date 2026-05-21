import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { evaluateMemberReadiness } from '../readiness-policy';
import { isForbidden, requireAdminPermission } from '../_admin-auth';

const ALLOWED_DECISIONS = ['approved','rejected','returned','suspended','pending'];

const DOC_LABEL: Record<string, string> = {
  thai_id_card: 'บัตรประชาชน',
  bank_book: 'หลักฐานบัญชีธนาคาร',
  land_doc: 'หลักฐานแปลง/ที่ดิน',
  vehicle_reg: 'ทะเบียนรถ',
};

const ROLE_REQUIRED_DOCS: Record<string, string[]> = {
  farmer: ['thai_id_card', 'bank_book', 'land_doc'],
  truck_owner: ['vehicle_reg', 'bank_book'],
};

export async function GET() {
  try {
    const _ar_get = await requireAdminPermission('members.read');
    if (isForbidden(_ar_get)) return _ar_get.forbidden;

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

    const rows = (data ?? []) as Record<string, unknown>[];
    const memberIds = rows.map((r) => String(r.member_id)).filter(Boolean);
    const [{ data: roleRows }, { data: docRows }] = await Promise.all([
      memberIds.length
        ? s.from('member_roles').select('member_id,role').in('member_id', memberIds)
        : Promise.resolve({ data: [] }),
      memberIds.length
        ? s.from('member_documents').select('member_id,doc_type').in('member_id', memberIds)
        : Promise.resolve({ data: [] }),
    ]);

    const rolesByMember = new Map<string, string[]>();
    for (const r of (roleRows ?? []) as { member_id: string; role: string }[]) {
      rolesByMember.set(r.member_id, [...(rolesByMember.get(r.member_id) ?? []), r.role]);
    }
    const docsByMember = new Map<string, Set<string>>();
    for (const d of (docRows ?? []) as { member_id: string; doc_type: string }[]) {
      docsByMember.set(d.member_id, new Set([...(docsByMember.get(d.member_id) ?? []), d.doc_type]));
    }

    let readyToApproveCount = 0;
    let missingDocumentsCount = 0;
    let bankNotVerifiedCount = 0;

    const items = rows.map((row) => {
      const memberId = String(row.member_id);
      const roles = rolesByMember.get(memberId) ?? [];
      const uploadedDocs = docsByMember.get(memberId) ?? new Set<string>();
      const requiredDocs = new Set<string>();
      for (const role of roles) {
        for (const docType of ROLE_REQUIRED_DOCS[role] ?? []) requiredDocs.add(docType);
      }
      const missingDocuments = [...requiredDocs]
        .filter((docType) => !uploadedDocs.has(docType))
        .map((docType) => DOC_LABEL[docType] ?? docType);

      const member = row.member as { bank_verified_status?: string | null } | null;
      const bankNotVerified = member?.bank_verified_status !== 'verified';
      const hasMissingDocuments = missingDocuments.length > 0;

      if (!hasMissingDocuments && !bankNotVerified) readyToApproveCount += 1;
      if (hasMissingDocuments) missingDocumentsCount += 1;
      if (bankNotVerified) bankNotVerifiedCount += 1;

      return {
        ...row,
        missingDocuments,
      };
    });

    const { count: returnedMembersCount, error: returnedError } = await s
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'returned');
    if (returnedError) return NextResponse.json({ error: returnedError.message }, { status: 500 });

    return NextResponse.json({
      items,
      summary: {
        pendingApprovals: rows.length,
        readyToApprove: readyToApproveCount,
        missingDocuments: missingDocumentsCount,
        bankNotVerified: bankNotVerifiedCount,
        returnedMembers: returnedMembersCount ?? 0,
      },
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    // ── Blocker 1: server-side admin validation ──────────────────────
    const _ar_post = await requireAdminPermission('members.approve');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;
    const { admin } = _ar_post;

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
    // NOTE: keep approval gate equivalent to legacy required fields.
    if (body.decision === 'approved') {
      const [{ data: m }, { data: memberRoles }, { data: memberPlots }, { data: memberVehicles }] = await Promise.all([
        s.from('members')
          .select('phone,address,subdistrict,district,province,citizen_id_masked,line_user_id,bank_name,bank_account_number,bank_verified_status')
          .eq('id', body.memberId).maybeSingle(),
        s.from('member_roles').select('role').eq('member_id', body.memberId),
        s.from('plots').select('id').eq('member_id', body.memberId).is('deleted_at', null).limit(1),
        s.from('member_vehicles').select('id').eq('member_id', body.memberId).is('deleted_at', null).limit(1),
      ]);

      if (m) {
        const readiness = evaluateMemberReadiness({
          phone: m.phone,
          address: m.address,
          subdistrict: m.subdistrict,
          district: m.district,
          province: m.province,
          citizen_id_masked: m.citizen_id_masked,
          line_user_id: m.line_user_id,
          bank_name: m.bank_name,
          bank_account_number: m.bank_account_number,
          bank_verified_status: m.bank_verified_status,
          has_plots: (memberPlots ?? []).length > 0,
          has_vehicles: (memberVehicles ?? []).length > 0,
          roles: (memberRoles ?? []).map((r) => r.role),
        });

        const missingGateFields = [
          !m.phone && 'phone',
          !m.subdistrict && 'subdistrict',
          !m.district && 'district',
          !m.province && 'province',
          m.bank_verified_status !== 'verified' && 'bank_verified_status',
        ].filter(Boolean) as string[];

        if (missingGateFields.length > 0 && !body.reason?.trim()) {
          return NextResponse.json({
            error: `ข้อมูลยังไม่ครบ: ${missingGateFields.join(', ')}`,
            incomplete: true,
            missing_fields: missingGateFields.join(', '),
            readyToApprove: readiness.readyToApprove,
            missingFields: readiness.missingFields,
            readinessReason: readiness.readinessReason,
            gateMissingFields: missingGateFields,
          }, { status: 422 });
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
