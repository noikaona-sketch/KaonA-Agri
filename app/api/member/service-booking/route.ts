import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve caller's member row from Bearer session token.
// member_id is NEVER accepted from the request body — always from the session.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCallerMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<
  | { ok: true;  memberId: string; memberStatus: string }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return {
      ok:       false,
      response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }),
    };
  }

  const { data: { user }, error: userError } = await s.auth.getUser(token);
  if (userError || !user) {
    return {
      ok:       false,
      response: NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 }),
    };
  }

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!member) {
    return {
      ok:       false,
      response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 403 }),
    };
  }

  return { ok: true, memberId: member.id, memberStatus: member.status };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/service-booking
// Body: { service_type, scheduled_date, note? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();

    const caller = await resolveCallerMember(request, s);
    if (!caller.ok) return caller.response;

    // Only approved members may submit bookings
    if (caller.memberStatus !== 'approved') {
      return NextResponse.json(
        { error: 'เฉพาะสมาชิกที่ได้รับอนุมัติแล้วเท่านั้นที่สามารถจองบริการได้' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      service_type?:   string;
      scheduled_date?: string;
      note?:           string;
    };

    const VALID_SERVICE_TYPES = ['tractor', 'harvester', 'transport'] as const;
    type ServiceType = typeof VALID_SERVICE_TYPES[number];

    if (!body.service_type || !VALID_SERVICE_TYPES.includes(body.service_type as ServiceType)) {
      return NextResponse.json(
        { error: 'กรุณาเลือกประเภทบริการ: tractor, harvester หรือ transport' },
        { status: 400 },
      );
    }

    if (!body.scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.scheduled_date)) {
      return NextResponse.json(
        { error: 'กรุณาระบุวันที่ต้องการใช้บริการ (รูปแบบ YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    // Reject past dates
    const today = new Date().toISOString().slice(0, 10);
    if (body.scheduled_date < today) {
      return NextResponse.json(
        { error: 'ไม่สามารถจองวันที่ผ่านมาแล้วได้' },
        { status: 400 },
      );
    }

    const { data, error } = await s
      .from('service_bookings')
      .insert({
        member_id:      caller.memberId,   // resolved server-side only
        service_type:   body.service_type,
        scheduled_date: body.scheduled_date,
        note:           body.note?.trim() || null,
        status:         'pending',
      })
      .select('id, status, service_type, scheduled_date, created_at')
      .single();

    if (error) {
      console.error('[SERVICE_BOOKING] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking: data }, { status: 201 });
  } catch (e) {
    console.error('[SERVICE_BOOKING] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/service-booking
// Returns caller's own bookings ordered by scheduled_date desc
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();

    const caller = await resolveCallerMember(request, s);
    if (!caller.ok) return caller.response;

    const { data, error } = await s
      .from('service_bookings')
      .select('id, service_type, scheduled_date, note, status, created_at')
      .eq('member_id', caller.memberId)
      .order('scheduled_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[SERVICE_BOOKING] GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (e) {
    console.error('[SERVICE_BOOKING] GET exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
