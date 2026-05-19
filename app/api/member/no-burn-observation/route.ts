import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Resolve caller — must have a service role (truck_owner/inspector/staff/admin)
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_ROLES = ['truck_owner', 'inspector', 'staff', 'admin'] as const;
type ServiceRole = typeof SERVICE_ROLES[number];

async function resolveServiceCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<
  | { ok: true;  memberId: string; serviceRole: ServiceRole }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }

  const { data: { user }, error: userError } = await s.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 }) };
  }

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!member || member.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิกหรือยังไม่อนุมัติ' }, { status: 403 }) };
  }

  const { data: roleRows } = await s
    .from('member_roles')
    .select('role')
    .eq('member_id', member.id);

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const serviceRole = SERVICE_ROLES.find((sr) => roles.includes(sr)) ?? null;

  if (!serviceRole) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'เฉพาะทีมบริการ (truck_owner / inspector / staff) เท่านั้นที่บันทึกหลักฐานได้' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, memberId: member.id, serviceRole };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/no-burn-observation
// Body JSON: {
//   no_burn_request_id, observed_condition,
//   note?, lat?, lng?, accuracy?, observation_date?
// }
//
// Supporting evidence only — does NOT change no_burn_requests.status.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveServiceCaller(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      no_burn_request_id?: string;
      observed_condition?: string;
      note?:               string;
      lat?:                number;
      lng?:                number;
      accuracy?:           number;
      observation_date?:   string;
    };

    if (!body.no_burn_request_id) {
      return NextResponse.json({ error: 'กรุณาระบุ no_burn_request_id' }, { status: 400 });
    }

    const VALID_CONDITIONS = ['no_burn_signs', 'burn_signs', 'partial_signs', 'unclear'];
    if (!body.observed_condition || !VALID_CONDITIONS.includes(body.observed_condition)) {
      return NextResponse.json(
        { error: 'กรุณาระบุ observed_condition: no_burn_signs / burn_signs / partial_signs / unclear' },
        { status: 400 },
      );
    }

    // Verify request exists
    const { data: nbrRow } = await s
      .from('no_burn_requests')
      .select('id, status')
      .eq('id', body.no_burn_request_id)
      .maybeSingle();

    if (!nbrRow) {
      return NextResponse.json({ error: 'ไม่พบคำของดเผานี้' }, { status: 404 });
    }

    const { data: newObs, error: insertError } = await s
      .from('no_burn_service_observations')
      .insert({
        no_burn_request_id: body.no_burn_request_id,
        observed_by:        caller.memberId,
        service_role:       caller.serviceRole,
        observed_condition: body.observed_condition,
        note:               body.note?.trim() || null,
        lat:                body.lat  ?? null,
        lng:                body.lng  ?? null,
        accuracy:           body.accuracy ?? null,
        observation_date:   body.observation_date ?? new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, observation_id: newObs.id, service_role: caller.serviceRole },
      { status: 201 },
    );
  } catch (e) {
    console.error('[NO_BURN_OBS] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/no-burn-observation?no_burn_request_id=<uuid>
// Returns observations for a request (for admin/service team review)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('no_burn_request_id');
    if (!requestId) return NextResponse.json({ observations: [] });

    const { data, error } = await s
      .from('no_burn_service_observations')
      .select('id, service_role, observed_condition, note, observation_date, lat, lng, created_at')
      .eq('no_burn_request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ observations: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
