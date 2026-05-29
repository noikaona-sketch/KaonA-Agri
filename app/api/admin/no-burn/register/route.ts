import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/no-burn/register
// Admin ลงทะเบียนงดเผาแทนสมาชิก
// body: { member_id, plot_id, timing, planting_cycle_id?, note? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('field.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const body = (await request.json()) as {
      member_id:          string;
      plot_id:            string;
      timing:             'before_planting' | 'after_planting';
      planting_cycle_id?: string | null;
      note?:              string | null;
    };

    if (!body.member_id || !body.plot_id || !body.timing)
      return NextResponse.json({ error: 'member_id, plot_id และ timing จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ── Validate member exists and is approved ──────────────────────────────
    const { data: member, error: memErr } = await s
      .from('members')
      .select('id, full_name, line_uid, status')
      .eq('id', body.member_id)
      .single();

    if (memErr || !member)
      return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
    if (member.status !== 'approved')
      return NextResponse.json({ error: 'สมาชิกยังไม่ได้รับการอนุมัติ' }, { status: 400 });

    // ── Validate plot belongs to member ────────────────────────────────────
    const { data: plot, error: plotErr } = await s
      .from('plots')
      .select('id, name, province')
      .eq('id', body.plot_id)
      .eq('member_id', body.member_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (plotErr || !plot)
      return NextResponse.json({ error: 'ไม่พบแปลงหรือแปลงนี้ไม่ใช่ของสมาชิกคนนี้' }, { status: 400 });

    // ── Check no duplicate active request ──────────────────────────────────
    const { data: existing } = await s
      .from('no_burn_requests')
      .select('id, status')
      .eq('member_id', body.member_id)
      .eq('plot_id', body.plot_id)
      .not('status', 'in', '("rejected","completed")')
      .is('deleted_at', null)
      .maybeSingle();

    if (existing)
      return NextResponse.json(
        { error: `มีคำขออยู่แล้ว (สถานะ: ${existing.status}) สำหรับแปลงนี้` },
        { status: 409 },
      );

    // ── Insert ─────────────────────────────────────────────────────────────
    const { data: newReq, error: insertErr } = await s
      .from('no_burn_requests')
      .insert({
        member_id:         body.member_id,
        plot_id:           body.plot_id,
        planting_cycle_id: body.planting_cycle_id ?? null,
        timing:            body.timing,
        status:            'submitted',
        consent_accepted:  true,
        note:              body.note?.trim() || `ลงทะเบียนโดยเจ้าหน้าที่`,
        submitted_at:      new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !newReq)
      return NextResponse.json({ error: insertErr?.message ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });

    // ── LINE notify member ─────────────────────────────────────────────────
    if (member.line_uid) {
      const timingText = body.timing === 'before_planting' ? 'ก่อนลงแปลง' : 'หลังลงแปลงแล้ว';
      await sendLineMessage(member.line_uid, [{
        type: 'text',
        text: `✅ เจ้าหน้าที่ลงทะเบียนโครงการงดเผาให้คุณแล้ว\n📍 แปลง: ${plot.name}${plot.province ? ` (${plot.province})` : ''}\n⏱ ${timingText}\n\nรอเจ้าหน้าที่ตรวจสอบและอนุมัติ`,
      }]);
    }

    return NextResponse.json({ ok: true, request_id: newReq.id });
  } catch (e) {
    console.error('[ADMIN_NO_BURN_REGISTER]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
