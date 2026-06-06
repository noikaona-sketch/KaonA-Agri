import { NextResponse }               from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const FIELD_ROLES  = ['staff', 'admin', 'inspector', 'leader'];
const VISIT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

async function resolveStaff(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<string | null> {
  const url         = new URL(request.url);
  const token       = request.headers.get('Authorization')?.slice(7)?.trim();
  const lineUserId  = url.searchParams.get('line_user_id') ?? undefined;
  const explicitId  = url.searchParams.get('member_id') ?? undefined;

  let memberId: string | null = null;

  // 1. Bearer token
  if (token) {
    const anon = createAnonSupabaseClient();
    const { data: { user } } = await anon.auth.getUser(token);
    if (user?.id) {
      const { data: m } = await s.from('members').select('id').eq('auth_user_id', user.id).maybeSingle();
      memberId = m?.id ?? null;
    }
    if (!memberId) {
      const { data: sess } = await s.from('sessions').select('member_id').eq('token', token).maybeSingle();
      memberId = sess?.member_id ?? null;
    }
  }

  // 2. line_user_id fallback (CASE B)
  if (!memberId && lineUserId) {
    const { data: m } = await s.from('members').select('id').eq('line_user_id', lineUserId).maybeSingle();
    memberId = m?.id ?? null;
  }

  // 3. explicit member_id fallback
  if (!memberId && explicitId) {
    memberId = explicitId;
  }

  if (!memberId) return null;

  const { data: role } = await s.from('member_roles').select('role')
    .eq('member_id', memberId).in('role', FIELD_ROLES).limit(1).maybeSingle();
  return role ? memberId : null;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const s       = createServerSupabaseClient();
  const staffId = await resolveStaff(request, s);
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url      = new URL(request.url);
  const mode     = url.searchParams.get('mode') ?? 'plots';
  const province = url.searchParams.get('province') ?? '';
  const memberId = url.searchParams.get('member_id') ?? '';
  const lat      = parseFloat(url.searchParams.get('lat') ?? '0');
  const lng      = parseFloat(url.searchParams.get('lng') ?? '0');
  const radius   = parseFloat(url.searchParams.get('radius') ?? '10');

  // GET visit logs for a specific member (admin tab)
  if (memberId && mode === 'logs') {
    const { data } = await s.from('field_visit_logs')
      .select(`
        id, visit_purpose, visit_purpose_note, note, follow_up,
        gps_lat, gps_lng, visited_at, updated_at,
        staff:staff_member_id(id, full_name),
        plots(id, name),
        photos(id, storage_path, photo_type)
      `)
      .eq('member_id', memberId)
      .order('visited_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ logs: data ?? [] });
  }

  if (mode === 'near_me' && lat && lng) {
    const { data } = await s.from('plots')
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
      .eq('status', 'approved');
    if (province) q = q.ilike('province', `%${province}%`);
    const { data } = await q.limit(100);
    return NextResponse.json({ members: data ?? [], mode });
  }

  const { data } = await s.from('plots')
    .select('id,name,lat,lng,area_rai,province,members:member_id(id,full_name,phone)')
    .not('lat', 'is', null).not('lng', 'is', null).limit(200);
  return NextResponse.json({ plots: data ?? [], mode });
}

// ── POST — บันทึก visit + แนบรูป (multipart) ─────────────────────────────────
export async function POST(request: Request) {
  const s       = createServerSupabaseClient();
  const staffId = await resolveStaff(request, s);
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // รองรับทั้ง JSON (legacy) และ multipart (new)
  const ct = request.headers.get('content-type') ?? '';
  let fields: Record<string, string | null> = {};
  let photoFiles: File[] = [];

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const get  = (k: string) => (form.get(k) as string | null)?.trim() || null;
    fields = {
      member_id:          get('member_id'),
      plot_id:            get('plot_id'),
      planting_season_id: get('planting_season_id'),
      visit_purpose:      get('visit_purpose'),
      visit_purpose_note: get('visit_purpose_note'),
      note:               get('note'),
      follow_up:          get('follow_up'),
      gps_lat:            get('gps_lat'),
      gps_lng:            get('gps_lng'),
      gps_accuracy:       get('gps_accuracy'),
      visited_at:         get('visited_at'),
    };
    for (let i = 0; i < 4; i++) {
      const f = form.get(`photo_${i}`);
      if (f instanceof File && f.size > 0) photoFiles.push(f);
    }
  } else {
    const body = await request.json() as Record<string, string | null>;
    fields = body;
  }

  if (!fields.member_id || !fields.visit_purpose)
    return NextResponse.json({ error: 'member_id และ visit_purpose จำเป็น' }, { status: 400 });

  const { data, error } = await s.from('field_visit_logs').insert({
    member_id:          fields.member_id,
    staff_member_id:    staffId,
    plot_id:            fields.plot_id            ?? null,
    planting_season_id: fields.planting_season_id ?? null,
    visit_purpose:      fields.visit_purpose,
    visit_purpose_note: fields.visit_purpose_note ?? null,
    note:               fields.note               ?? null,
    follow_up:          fields.follow_up          ?? null,
    gps_lat:            fields.gps_lat ? parseFloat(fields.gps_lat) : null,
    gps_lng:            fields.gps_lng ? parseFloat(fields.gps_lng) : null,
    gps_accuracy:       fields.gps_accuracy ? parseFloat(fields.gps_accuracy) : null,
    visited_at:         fields.visited_at ?? new Date().toISOString(),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const logId = (data as { id: string }).id;

  // Upload + register photos
  const photoWarnings: string[] = [];
  for (let i = 0; i < photoFiles.length; i++) {
    const photo = photoFiles[i];
    const ext   = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path  = `field-visit/${staffId}/${logId}_photo${i}_${Date.now()}.${ext}`;

    const { error: upErr } = await s.storage
      .from(VISIT_BUCKET).upload(path, photo, { upsert: false });
    if (upErr) { photoWarnings.push(`photo_${i}: ${upErr.message}`); continue; }

    await s.from('photos').insert({
      member_id:          fields.member_id,
      field_visit_log_id: logId,
      storage_path:       path,
      photo_type:         'field_visit',
      lat:                fields.gps_lat ? parseFloat(fields.gps_lat) : 0,
      lng:                fields.gps_lng ? parseFloat(fields.gps_lng) : 0,
      accuracy:           fields.gps_accuracy ? parseFloat(fields.gps_accuracy) : null,
      captured_at:        fields.visited_at ?? new Date().toISOString(),
      uploaded_by:        staffId,
    });
  }

  return NextResponse.json({
    ok: true, id: logId,
    photo_warnings: photoWarnings.length ? photoWarnings : undefined,
  }, { status: 201 });
}

// ── PATCH — admin แก้ไข visit log ─────────────────────────────────────────────
export async function PATCH(request: Request) {
  const s       = createServerSupabaseClient();
  const staffId = await resolveStaff(request, s);
  if (!staffId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    log_id:              string;
    visit_purpose?:      string;
    visit_purpose_note?: string | null;
    note?:               string | null;
    follow_up?:          string | null;
    visited_at?:         string;
  };

  if (!body.log_id)
    return NextResponse.json({ error: 'log_id จำเป็น' }, { status: 400 });

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: staffId,
  };
  if (body.visit_purpose      !== undefined) patch.visit_purpose      = body.visit_purpose;
  if (body.visit_purpose_note !== undefined) patch.visit_purpose_note = body.visit_purpose_note;
  if (body.note               !== undefined) patch.note               = body.note;
  if (body.follow_up          !== undefined) patch.follow_up          = body.follow_up;
  if (body.visited_at         !== undefined) patch.visited_at         = body.visited_at;

  const { error } = await s.from('field_visit_logs')
    .update(patch).eq('id', body.log_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

