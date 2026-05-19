import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Resolve caller from Bearer token (shared pattern)
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<
  | { ok: true;  memberId: string; memberStatus: string; roles: string[] }
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
  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 403 }) };
  }
  if (member.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
  }
  // Get roles to determine confirmation_type
  const { data: roleRows } = await s
    .from('member_roles')
    .select('role')
    .eq('member_id', member.id);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  return { ok: true, memberId: member.id, memberStatus: member.status, roles };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/no-burn-confirmation
// Body JSON: { no_burn_request_id, note? }
//
// Positive confirmation only — any approved member can confirm.
// confirmation_type derived from caller's role (leader vs nearby_member).
// Duplicate confirmation from same member → 409 (unique index).
// Does NOT change no_burn_requests.status — staff reviews confirmations.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      no_burn_request_id?: string;
      note?:               string;
    };

    if (!body.no_burn_request_id) {
      return NextResponse.json({ error: 'กรุณาระบุ no_burn_request_id' }, { status: 400 });
    }

    // Verify the request exists and is confirmable
    const { data: nbrRow } = await s
      .from('no_burn_requests')
      .select('id, status, member_id')
      .eq('id', body.no_burn_request_id)
      .maybeSingle();

    if (!nbrRow) {
      return NextResponse.json({ error: 'ไม่พบคำของดเผานี้' }, { status: 404 });
    }

    // Member cannot confirm their own request
    if (nbrRow.member_id === caller.memberId) {
      return NextResponse.json({ error: 'ไม่สามารถยืนยันคำขอของตัวเองได้' }, { status: 409 });
    }

    // Only confirm active requests (not rejected or completed)
    const CONFIRMABLE = ['submitted', 'under_review', 'inspection_required', 'anomaly', 'seeking_support', 'approved'];
    if (!CONFIRMABLE.includes(nbrRow.status)) {
      return NextResponse.json(
        { error: 'คำของดเผานี้ไม่อยู่ในสถานะที่รับการยืนยันได้' },
        { status: 409 },
      );
    }

    // Derive confirmation_type from caller's roles
    const confirmationType = caller.roles.includes('leader') ? 'leader' : 'nearby_member';

    const { error: insertError } = await s.from('no_burn_confirmations').insert({
      no_burn_request_id: body.no_burn_request_id,
      confirmed_by:       caller.memberId,
      confirmation_type:  confirmationType,
      note:               body.note?.trim() || null,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'ท่านได้ยืนยันคำของดเผานี้แล้ว' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, confirmation_type: confirmationType }, { status: 201 });
  } catch (e) {
    console.error('[NO_BURN_CONFIRM] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/no-burn-confirmation?no_burn_request_id=<uuid>
// Returns confirmations for a specific request.
// Privacy: returns id, confirmation_type, note, created_at only.
// member names are NOT returned — role labels only.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('no_burn_request_id');
    if (!requestId) {
      return NextResponse.json({ confirmations: [], count: 0 });
    }

    const { data, error } = await s
      .from('no_burn_confirmations')
      .select('id, confirmation_type, note, created_at')
      .eq('no_burn_request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ confirmations: data ?? [], count: (data ?? []).length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/member/no-burn-confirmation
// Body JSON: { no_burn_request_id }
// Member withdraws their own confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as { no_burn_request_id?: string };
    if (!body.no_burn_request_id) {
      return NextResponse.json({ error: 'กรุณาระบุ no_burn_request_id' }, { status: 400 });
    }

    const { error } = await s
      .from('no_burn_confirmations')
      .delete()
      .eq('no_burn_request_id', body.no_burn_request_id)
      .eq('confirmed_by', caller.memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
