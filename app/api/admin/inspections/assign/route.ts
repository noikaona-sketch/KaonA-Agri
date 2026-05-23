import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// POST /api/admin/inspections/assign
// body: { inspection_id, inspector_member_id }
export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('field.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const { inspection_id, inspector_member_id } =
      (await request.json()) as { inspection_id: string; inspector_member_id: string };

    if (!inspection_id || !inspector_member_id)
      return NextResponse.json({ error: 'inspection_id และ inspector_member_id จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ดึง inspection + plot + farmer ก่อน
    const { data: inspection, error: fetchErr } = await s
      .from('inspections')
      .select(`id, plot_id,
        plots!inspections_plot_id_fkey(name, province),
        no_burn_requests!inspections_no_burn_request_id_fkey(
          member_id,
          members!no_burn_requests_member_id_fkey(full_name, line_uid)
        )`)
      .eq('id', inspection_id)
      .single();

    if (fetchErr || !inspection)
      return NextResponse.json({ error: 'ไม่พบ inspection' }, { status: 404 });

    // assign
    const { error: updateErr } = await s
      .from('inspections')
      .update({
        inspector_member_id,
        assigned_at:    new Date().toISOString(),
        result_status:  'assigned',
      })
      .eq('id', inspection_id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Z4-6: LINE แจ้ง inspector — fail silently
    const { data: inspector } = await s
      .from('members')
      .select('full_name, line_uid')
      .eq('id', inspector_member_id)
      .maybeSingle();

    if (inspector?.line_uid) {
      const plot     = inspection.plots as unknown as { name: string | null; province: string | null } | null;
      const noBurnReq = inspection.no_burn_requests as unknown as { members: { full_name: string } | null } | null;
      const farmerName = noBurnReq?.members?.full_name ?? 'ไม่ระบุ';
      const plotName   = plot?.name ?? `แปลง ${inspection.plot_id?.slice(0, 8)}`;

      void sendLineMessage(inspector.line_uid as string, [{
        type: 'text',
        text: [
          `📋 คุณมีงานตรวจแปลงใหม่`,
          `🌱 แปลง: ${plotName}${plot?.province ? ` (${plot.province})` : ''}`,
          `👤 เกษตรกร: ${farmerName}`,
          `\nแตะที่แอปเพื่อดูรายละเอียดและบันทึกผลการตรวจ`,
        ].join('\n'),
      }]);
    }

    return NextResponse.json({ ok: true, inspection_id, inspector_member_id });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
