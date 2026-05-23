import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// POST /api/admin/no-burn/decision
// body: { request_id, decision: 'approved'|'rejected'|'inspection_required', note?, trigger_inspection? }
export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('field.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const adminId = _ar.admin.adminUserId;

    const body = (await request.json()) as {
      request_id         : string
      decision           : 'approved' | 'rejected' | 'inspection_required'
      note?              : string
      trigger_inspection?: boolean   // Z5-3: สร้าง inspection task อัตโนมัติ
    };

    if (!body.request_id || !body.decision)
      return NextResponse.json({ error: 'request_id และ decision จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ── ดึง request + member + plot ─────────────────────────────────────
    const { data: req, error: fetchErr } = await s
      .from('no_burn_requests')
      .select(`id, member_id, planting_cycle_id, status,
        members!no_burn_requests_member_id_fkey(full_name, line_uid),
        planting_cycles!no_burn_requests_planting_cycle_id_fkey(
          plots!planting_cycles_plot_id_fkey(id, name, province)
        )`)
      .eq('id', body.request_id)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });

    // ── อัปเดต status ────────────────────────────────────────────────────
    await s.from('no_burn_requests').update({
      status:      body.decision,
      review_note: body.note?.trim() || null,
      reviewed_by: adminId,
      updated_at:  new Date().toISOString(),
    }).eq('id', body.request_id);

    // ── Z5-1: LINE แจ้ง farmer — fail silently ────────────────────────────
    type MemberRow = { full_name: string; line_uid: string | null } | null;
    const member = req.members as unknown as MemberRow;

    if (member?.line_uid) {
      const msg = body.decision === 'approved'
        ? [
            `🌿 ยินดีด้วย! คำขอโครงการไม่เผาของคุณได้รับการอนุมัติแล้ว`,
            `โบนัสราคาพิเศษจะถูกคำนวณเมื่อขายผลผลิต`,
            body.note ? `\nหมายเหตุ: ${body.note}` : '',
          ].filter(Boolean).join('\n')
        : body.decision === 'rejected'
        ? [
            `❌ ขออภัย คำขอโครงการไม่เผาของคุณยังไม่ผ่านการอนุมัติ`,
            body.note ? `เหตุผล: ${body.note}` : '',
            `\nกรุณาติดต่อเจ้าหน้าที่เพื่อข้อมูลเพิ่มเติม`,
          ].filter(Boolean).join('\n')
        : [
            `📋 คำขอโครงการไม่เผาของคุณอยู่ระหว่างการตรวจสอบแปลง`,
            `เจ้าหน้าที่จะติดต่อกลับเพื่อนัดตรวจแปลงในเร็วๆ นี้`,
          ].join('\n');

      void sendLineMessage(member.line_uid, [{ type:'text', text:msg }]);
    }

    // ── Z5-3: trigger inspection เมื่อ inspection_required หรือ approve แบบส่งตรวจ ──
    let inspectionId: string | null = null;

    if (body.decision === 'inspection_required' || body.trigger_inspection) {
      type PlotRow = { id: string } | null;
      type CycleRow = { plots: PlotRow } | null;
      const cycle = req.planting_cycles as unknown as CycleRow;
      const plotId = cycle?.plots?.id ?? null;

      if (plotId) {
        const { data: ins } = await s.from('inspections').insert({
          no_burn_request_id : body.request_id,
          plot_id            : plotId,
          inspector_member_id: adminId,   // placeholder — admin assign ทีหลัง
          result_status      : 'pending',
        }).select('id').single();
        inspectionId = ins?.id ?? null;
      }
    }

    return NextResponse.json({
      ok:            true,
      decision:      body.decision,
      inspection_id: inspectionId,
      line_sent:     !!member?.line_uid,
    });

  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
