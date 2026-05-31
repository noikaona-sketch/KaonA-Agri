import { NextResponse }               from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const FIELD_ROLES = ['staff', 'admin', 'inspector', 'leader'];

async function resolveInspector(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Try Supabase JWT first
  const anon = createAnonSupabaseClient();
  const { data: { user } } = await anon.auth.getUser(token);
  let memberId: string | null = null;

  if (user?.id) {
    const { data: m } = await s.from('members').select('id').eq('auth_user_id', user.id).maybeSingle();
    memberId = m?.id ?? null;
  } else {
    const { data: session } = await s.from('sessions').select('member_id').eq('token', token).maybeSingle();
    memberId = session?.member_id ?? null;
  }

  if (!memberId) return null;
  const { data: role } = await s.from('member_roles').select('role')
    .eq('member_id', memberId).in('role', FIELD_ROLES).limit(1).maybeSingle();
  return role ? memberId : null;
}

type SoilAssessment = {
  soil_color?    : string | null;
  soil_texture?  : string | null;
  soil_drainage? : string | null;
  soil_moisture? : string | null;
  soil_issues?   : string[];
  soil_note?     : string | null;
};

type CertRecord = {
  cert_agency?       : string | null;
  cert_number?       : string | null;
  cert_issued_date?  : string | null;
  cert_expires_date? : string | null;
};

type LabRecord = {
  lab_submitted?    : boolean;
  lab_name?         : string | null;
  lab_submitted_at? : string | null;
  lab_tracking_no?  : string | null;
};

type PatchBody = {
  inspection_id          : string;
  result_status          : 'passed' | 'failed' | 'needs_update';
  result_note            : string;
  visited_at?            : string;
  gps_lat?               : number;
  gps_lng?               : number;
  gps_accuracy?          : number;
  inspector_submitted_at?: string;
} & SoilAssessment & CertRecord & LabRecord;

export async function PATCH(request: Request) {
  try {
    const s           = createServerSupabaseClient();
    const inspectorId = await resolveInspector(request, s);
    if (!inspectorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as PatchBody;

    if (!body.inspection_id || !body.result_status)
      return NextResponse.json({ error: 'inspection_id และ result_status จำเป็น' }, { status: 400 });

    const { data: ins } = await s.from('inspections')
      .select('inspector_member_id').eq('id', body.inspection_id).maybeSingle();
    if (!ins) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });
    if (ins.inspector_member_id !== inspectorId)
      return NextResponse.json({ error: 'ไม่ใช่งานของคุณ' }, { status: 403 });

    await s.from('inspections').update({
      // Core
      result_status          : body.result_status,
      result_note            : body.result_note,
      visited_at             : body.visited_at ?? new Date().toISOString(),
      inspector_submitted_at : body.inspector_submitted_at ?? new Date().toISOString(),
      ...(body.gps_lat && body.gps_lng ? {
        gps_lat: body.gps_lat, gps_lng: body.gps_lng, gps_accuracy: body.gps_accuracy ?? null,
      } : {}),
      // Soil assessment (A)
      ...(body.soil_color     !== undefined && { soil_color:    body.soil_color }),
      ...(body.soil_texture   !== undefined && { soil_texture:  body.soil_texture }),
      ...(body.soil_drainage  !== undefined && { soil_drainage: body.soil_drainage }),
      ...(body.soil_moisture  !== undefined && { soil_moisture: body.soil_moisture }),
      ...(body.soil_issues    !== undefined && { soil_issues:   body.soil_issues }),
      ...(body.soil_note      !== undefined && { soil_note:     body.soil_note }),
      // Cert (C)
      ...(body.cert_agency       !== undefined && { cert_agency:       body.cert_agency }),
      ...(body.cert_number       !== undefined && { cert_number:       body.cert_number }),
      ...(body.cert_issued_date  !== undefined && { cert_issued_date:  body.cert_issued_date }),
      ...(body.cert_expires_date !== undefined && { cert_expires_date: body.cert_expires_date }),
      // Lab
      ...(body.lab_submitted    !== undefined && { lab_submitted:    body.lab_submitted }),
      ...(body.lab_name         !== undefined && { lab_name:         body.lab_name }),
      ...(body.lab_submitted_at !== undefined && { lab_submitted_at: body.lab_submitted_at }),
      ...(body.lab_tracking_no  !== undefined && { lab_tracking_no:  body.lab_tracking_no }),
    }).eq('id', body.inspection_id);

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
