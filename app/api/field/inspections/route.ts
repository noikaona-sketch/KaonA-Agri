import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const FIELD_ROLES = ['staff','admin','inspector','leader'];

async function resolveInspector(request: Request, s: ReturnType<typeof createServerSupabaseClient>) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data } = await s.from('sessions').select('member_id').eq('token', token).maybeSingle();
  if (!data?.member_id) return null;
  const { data: role } = await s.from('member_roles').select('role').eq('member_id', data.member_id)
    .in('role', FIELD_ROLES).limit(1).maybeSingle();
  return role ? data.member_id as string : null;
}

// PATCH /api/field/inspections — บันทึกผลตรวจแปลง
export async function PATCH(request: Request) {
  try {
    const s          = createServerSupabaseClient();
    const inspectorId = await resolveInspector(request, s);
    if (!inspectorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      inspection_id : string
      result_status : 'passed' | 'failed' | 'needs_update'
      result_note   : string
      visited_at?   : string
      gps_lat?      : number
      gps_lng?      : number
    };

    if (!body.inspection_id || !body.result_status)
      return NextResponse.json({ error: 'inspection_id และ result_status จำเป็น' }, { status: 400 });

    // ตรวจว่า inspector เป็นเจ้าของงานนี้
    const { data: ins } = await s.from('inspections')
      .select('inspector_member_id').eq('id', body.inspection_id).maybeSingle();
    if (!ins) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });
    if (ins.inspector_member_id !== inspectorId)
      return NextResponse.json({ error: 'ไม่ใช่งานของคุณ' }, { status: 403 });

    await s.from('inspections').update({
      result_status : body.result_status,
      result_note   : body.result_note,
      visited_at    : body.visited_at ?? new Date().toISOString(),
      ...(body.gps_lat && body.gps_lng ? { gps_lat:body.gps_lat, gps_lng:body.gps_lng } : {}),
    }).eq('id', body.inspection_id);

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
