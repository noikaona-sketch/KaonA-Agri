import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Shared: resolve caller from Bearer token
// member_id is NEVER accepted from request body.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<
  | { ok: true;  memberId: string }
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
    .from('members').select('id, status').eq('auth_user_id', user.id).maybeSingle();
  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 403 }) };
  }
  if (member.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
  }
  return { ok: true, memberId: member.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/harvest-booking
//
// P2 v1 — farmer forecast/estimate only.
// Body JSON: {
//   planting_cycle_id  string   required
//   scheduled_date     string   required (expected harvest date)
//   plot_id?           string   optional
//   note?              string   optional
//   -- P2 v1 new fields (from migration 202605180010) --
//   drying_preference?     'required'|'optional'|'not_required'|'unknown'
//   delivery_type?         'fresh'|'field_dry'|'unknown'
//   estimated_moisture_pct? number
//   moisture_source?       'farmer_estimate'|'field_test'|'factory_measure'
//   estimated_yield_kg?    number  (farmer's own estimate, separate from cycle.estimated_yield_kg)
// }
//
// member_id resolved from Bearer token — never from body.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_DRYING   = ['required', 'optional', 'not_required', 'unknown'] as const;
const VALID_DELIVERY = ['fresh', 'field_dry', 'unknown'] as const;
const VALID_MOISTURE_SOURCE = ['farmer_estimate', 'field_test', 'factory_measure'] as const;

type DryingPref      = typeof VALID_DRYING[number];
type DeliveryType    = typeof VALID_DELIVERY[number];
type MoistureSource  = typeof VALID_MOISTURE_SOURCE[number];

export async function POST(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      planting_cycle_id:     string;
      scheduled_date:        string;
      plot_id?:              string;
      note?:                 string;
      drying_preference?:    DryingPref;
      delivery_type?:        DeliveryType;
      estimated_moisture_pct?: number;
      moisture_source?:      MoistureSource;
      estimated_yield_kg?:   number;
    };

    if (!body.planting_cycle_id || !body.scheduled_date) {
      return NextResponse.json({ error: 'กรุณาระบุรอบปลูกและวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });
    }

    // Validate new fields
    if (body.drying_preference && !VALID_DRYING.includes(body.drying_preference)) {
      return NextResponse.json({ error: 'drying_preference ไม่ถูกต้อง' }, { status: 400 });
    }
    if (body.delivery_type && !VALID_DELIVERY.includes(body.delivery_type)) {
      return NextResponse.json({ error: 'delivery_type ไม่ถูกต้อง' }, { status: 400 });
    }
    if (body.moisture_source && !VALID_MOISTURE_SOURCE.includes(body.moisture_source)) {
      return NextResponse.json({ error: 'moisture_source ไม่ถูกต้อง' }, { status: 400 });
    }

    // Verify planting cycle belongs to caller
    const { data: cycle } = await s
      .from('planting_cycles')
      .select('id, member_id, status, crop_name, estimated_yield_kg')
      .eq('id', body.planting_cycle_id)
      .maybeSingle();

    if (!cycle) {
      return NextResponse.json({ error: 'ไม่พบรอบปลูก' }, { status: 404 });
    }
    if (cycle.member_id !== caller.memberId) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้รอบปลูกนี้' }, { status: 403 });
    }

    // Only allow forecast for active cycles
    const HARVESTABLE = ['planted', 'growing', 'flowering', 'maturing', 'fruiting', 'ready'];
    if (!HARVESTABLE.includes(cycle.status ?? '')) {
      return NextResponse.json(
        { error: `รอบปลูกสถานะ "${cycle.status}" ยังไม่พร้อมแจ้งเก็บเกี่ยว` },
        { status: 409 },
      );
    }

    // Prevent duplicate pending/confirmed booking for same cycle
    const { data: existing } = await s
      .from('harvest_bookings')
      .select('id')
      .eq('planting_cycle_id', body.planting_cycle_id)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'มีการแจ้งเก็บเกี่ยวรอดำเนินการอยู่แล้ว' }, { status: 409 });
    }

    const { data, error } = await s.from('harvest_bookings').insert({
      planting_cycle_id:      body.planting_cycle_id,
      member_id:              caller.memberId,   // from session — never from body
      scheduled_date:         body.scheduled_date,
      plot_id:                body.plot_id            ?? null,
      note:                   body.note               ?? null,
      drying_preference:      body.drying_preference  ?? 'unknown',
      delivery_type:          body.delivery_type       ?? 'unknown',
      estimated_moisture_pct: body.estimated_moisture_pct ?? null,
      moisture_source:        body.moisture_source    ?? null,
      actual_yield_kg:        body.estimated_yield_kg ?? null,  // pre-fill estimate; updated after actual harvest
      status: 'pending',
    }).select('id').single();

    if (error) {
      console.error('[HARVEST_BOOKING] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking_id: data.id }, { status: 201 });
  } catch (e) {
    console.error('[HARVEST_BOOKING] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/harvest-booking?cycle_id=<uuid>
// Returns bookings for a planting cycle (caller must own the cycle via Bearer token)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycle_id');
    if (!cycleId) return NextResponse.json({ bookings: [] });

    const { data, error } = await s
      .from('harvest_bookings')
      .select(
        'id, scheduled_date, status, actual_yield_kg, note,' +
        'drying_preference, delivery_type, estimated_moisture_pct, moisture_source',
      )
      .eq('planting_cycle_id', cycleId)
      .eq('member_id', caller.memberId)   // scope to caller
      .order('scheduled_date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bookings: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
