import { NextResponse }               from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const FIELD_ROLES = ['staff','admin','inspector','leader'];

async function resolveStaff(request: Request, s: ReturnType<typeof createServerSupabaseClient>): Promise<string | null> {
  const token = request.headers.get('Authorization')?.slice(7);
  if (!token) return null;
  const anon = createAnonSupabaseClient();
  const { data: { user } } = await anon.auth.getUser(token);
  let memberId: string | null = null;
  if (user?.id) {
    const { data: m } = await s.from('members').select('id').eq('auth_user_id', user.id).maybeSingle();
    memberId = m?.id ?? null;
  } else {
    const { data: sess } = await s.from('sessions').select('member_id').eq('token', token).maybeSingle();
    memberId = sess?.member_id ?? null;
  }
  if (!memberId) return null;
  const { data: role } = await s.from('member_roles').select('role').eq('member_id', memberId).in('role', FIELD_ROLES).limit(1).maybeSingle();
  return role ? memberId : null;
}

// GET /api/field/visit-log?mode=near_me|province|plots&lat=&lng=&radius=&province=&member_id=
export async function GET(request: Request) {
  const s      = createServerSupabaseClient();
  const staffId = await resolveStaff(request, s);
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url      = new URL(request.url);
  const mode     = url.searchParams.get('mode') ?? 'plots';
  const province = url.searchParams.get('province') ?? '';
  const memberId = url.searchParams.get('member_id') ?? '';
  const lat      = parseFloat(url.searchParams.get('lat') ?? '0');
  const lng      = parseFloat(url.searchParams.get('lng') ?? '0');
  const radius   = parseFloat(url.searchParams.get('radius') ?? '10'); // km

  if (mode === 'near_me' && lat && lng) {
    // members with plots near GPS location
    const { data } = await s
      .from('plots')
      .select('id,name,lat,lng,area_rai,members:member_id(id,full_name,phone,province)')
      .not('lat', 'is', null).not('lng', 'is', null)
      .gte('lat', lat - radius/111).lte('lat', lat + radius/111)
      .gte('lng', lng - radius/88).lte('lng', lng + radius/88)
      .limit(50);
    return NextResponse.json({ plots: data ?? [], mode });
  }

  if (mode === 'province') {
    let q = s.from('members')
      .select('id,full_name,phone,province,district,subdistrict,plots(id,name,lat,lng,area_rai)')
      .eq('status', 'approved').not('plots', 'is', null);
    if (province) q = q.ilike('province', `%${province}%`);
    const { data } = await q.limit(100);
    return NextResponse.json({ members: data ?? [], mode });
  }

  // mode = plots — all plots with GPS
  const { data } = await s
    .from('plots')
    .select('id,name,lat,lng,area_rai,province,members:member_id(id,full_name,phone)')
    .not('lat', 'is', null).not('lng', 'is', null)
    .limit(200);
  return NextResponse.json({ plots: data ?? [], mode });
}

// POST /api/field/visit-log — บันทึก visit
export async function POST(request: Request) {
  const s       = createServerSupabaseClient();
  const staffId = await resolveStaff(request, s);
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    member_id: string; plot_id?: string; planting_season_id?: string;
    visit_purpose: string; visit_purpose_note?: string;
    note?: string; follow_up?: string;
    gps_lat?: number; gps_lng?: number; gps_accuracy?: number;
    visited_at?: string;
  };

  if (!body.member_id || !body.visit_purpose)
    return NextResponse.json({ error: 'member_id และ visit_purpose จำเป็น' }, { status: 400 });

  const { data, error } = await s.from('field_visit_logs').insert({
    member_id:          body.member_id,
    staff_member_id:    staffId,
    plot_id:            body.plot_id            ?? null,
    planting_season_id: body.planting_season_id ?? null,
    visit_purpose:      body.visit_purpose,
    visit_purpose_note: body.visit_purpose_note ?? null,
    note:               body.note               ?? null,
    follow_up:          body.follow_up          ?? null,
    gps_lat:            body.gps_lat            ?? null,
    gps_lng:            body.gps_lng            ?? null,
    gps_accuracy:       body.gps_accuracy       ?? null,
    visited_at:         body.visited_at         ?? new Date().toISOString(),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
