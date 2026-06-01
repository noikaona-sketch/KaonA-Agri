import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

type LabResultPayload = {
  inspection_id  : string;
  lab_result_at  : string;
  lab_ph?        : number | null;
  lab_om_pct?    : number | null;
  lab_result_note?: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission('field.write');
    if (isForbidden(auth)) return auth.forbidden;

    const body = (await request.json()) as LabResultPayload;
    if (!body.inspection_id || !body.lab_result_at) {
      return NextResponse.json({ error: 'inspection_id และ lab_result_at จำเป็น' }, { status: 400 });
    }

    if (body.lab_ph != null && (body.lab_ph < 0 || body.lab_ph > 14)) {
      return NextResponse.json({ error: 'ค่า pH ต้องอยู่ระหว่าง 0–14' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    // Verify inspection exists and has lab_submitted = true
    const { data: ins } = await s.from('inspections')
      .select('id, lab_submitted').eq('id', body.inspection_id).maybeSingle();
    if (!ins) return NextResponse.json({ error: 'ไม่พบงานตรวจ' }, { status: 404 });
    if (!ins.lab_submitted) return NextResponse.json({ error: 'งานนี้ไม่ได้ส่งดินตรวจ' }, { status: 400 });

    const { error: updateErr } = await s.from('inspections').update({
      lab_result_at:   body.lab_result_at,
      lab_ph:          body.lab_ph          ?? null,
      lab_om_pct:      body.lab_om_pct      ?? null,
      lab_result_note: body.lab_result_note ?? null,
    }).eq('id', body.inspection_id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
