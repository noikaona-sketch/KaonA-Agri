import { NextResponse }               from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['inspector', 'admin'];
const SURVEY_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

// Resolve staff/inspector member — Bearer token required
async function resolveFieldMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<{ memberId: string } | null> {
  const token = request.headers.get('Authorization')?.slice(7)?.trim();
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

  // Check role
  const { data: role } = await s.from('member_roles')
    .select('role').eq('member_id', memberId)
    .in('role', ALLOWED_ROLES).limit(1).maybeSingle();

  return role ? { memberId } : null;
}

// ── GET /api/field/survey-observation ────────────────────────────────────────
// Query params: my=1 (own only), limit=20, offset=0, status=unconfirmed|confirmed
export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveFieldMember(request, s);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url    = new URL(request.url);
  const myOnly = url.searchParams.get('my') === '1';
  const status = url.searchParams.get('status') ?? '';
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  let q = s.from('field_survey_observations')
    .select(`
      id, lat, lng, accuracy, crop_type, crop_type_note,
      estimated_age_days, estimated_area_rai, growth_stage,
      plant_condition, condition_note, note,
      confirmation_status, observed_at, created_at,
      observer:observer_id(id, full_name),
      member:member_id(id, full_name),
      plot:plot_id(id, name, province),
      field_survey_photos(id, storage_path, caption, taken_at)
    `)
    .order('observed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (myOnly) q = q.eq('observer_id', caller.memberId);
  if (status) q = q.eq('confirmation_status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ observations: data ?? [] });
}

// ── POST /api/field/survey-observation ───────────────────────────────────────
// multipart/form-data
// Required: lat, lng, crop_type
// Optional: accuracy, member_id, plot_id, planting_cycle_id,
//           estimated_age_days, estimated_area_rai, growth_stage,
//           plant_condition, condition_note, note, crop_type_note
//           photo_0..3 (JPEG files)
export async function POST(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveFieldMember(request, s);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'ต้องส่งข้อมูลแบบ multipart/form-data' }, { status: 400 }); }

  const get = (k: string) => (form.get(k) as string | null)?.trim() || null;
  const num = (k: string) => { const v = get(k); return v ? Number(v) : null; };

  const lat = num('lat'); const lng = num('lng');
  if (!lat || !lng) return NextResponse.json({ error: 'lat และ lng จำเป็น' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return NextResponse.json({ error: 'lat/lng ไม่ถูกต้อง' }, { status: 400 });

  const cropType = get('crop_type') ?? 'corn';

  // Insert observation
  const { data: obs, error: obsError } = await s.from('field_survey_observations').insert({
    observer_id:          caller.memberId,
    member_id:            get('member_id'),
    plot_id:              get('plot_id'),
    planting_cycle_id:    get('planting_cycle_id'),
    lat, lng,
    accuracy:             num('accuracy'),
    crop_type:            cropType,
    crop_type_note:       get('crop_type_note'),
    estimated_age_days:   num('estimated_age_days'),
    estimated_area_rai:   num('estimated_area_rai'),
    growth_stage:         get('growth_stage'),
    plant_condition:      get('plant_condition'),
    condition_note:       get('condition_note'),
    note:                 get('note'),
    observed_at:          get('observed_at') ?? new Date().toISOString(),
  }).select('id').single();

  if (obsError) {
    console.error('[SURVEY_OBS] insert error:', obsError.message);
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  const obsId = (obs as { id: string }).id;

  // Upload photos (best-effort)
  const photoWarnings: string[] = [];
  for (let i = 0; i < 4; i++) {
    const photo = form.get(`photo_${i}`);
    if (!(photo instanceof File) || photo.size === 0) continue;

    const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `survey/${caller.memberId}/${obsId}_photo${i}_${Date.now()}.${ext}`;

    const { error: upErr } = await s.storage
      .from(SURVEY_BUCKET).upload(path, photo, { upsert: false });

    if (upErr) { photoWarnings.push(`photo_${i}: ${upErr.message}`); continue; }

    const caption = get(`caption_${i}`);
    await s.from('field_survey_photos').insert({
      observation_id: obsId,
      storage_path:   path,
      caption:        caption,
      lat:            num(`photo_lat_${i}`) ?? lat,
      lng:            num(`photo_lng_${i}`) ?? lng,
      taken_at:       get(`photo_taken_at_${i}`) ?? new Date().toISOString(),
      uploaded_by:    caller.memberId,
    });
  }

  return NextResponse.json({ ok: true, observation_id: obsId, photo_warnings: photoWarnings.length ? photoWarnings : undefined }, { status: 201 });
}

// ── PATCH /api/field/survey-observation ──────────────────────────────────────
// Confirm/reject observation (admin/staff) or update own (observer)
export async function PATCH(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveFieldMember(request, s);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    observation_id: string;
    confirmation_status?: 'confirmed' | 'rejected';
    member_id?: string | null;
    plot_id?: string | null;
    planting_cycle_id?: string | null;
    note?: string | null;
  };

  if (!body.observation_id)
    return NextResponse.json({ error: 'observation_id จำเป็น' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.confirmation_status !== undefined) {
    patch.confirmation_status = body.confirmation_status;
    if (body.confirmation_status === 'confirmed') {
      patch.confirmed_by = caller.memberId;
      patch.confirmed_at = new Date().toISOString();
    }
  }
  if (body.member_id           !== undefined) patch.member_id           = body.member_id;
  if (body.plot_id              !== undefined) patch.plot_id              = body.plot_id;
  if (body.planting_cycle_id   !== undefined) patch.planting_cycle_id   = body.planting_cycle_id;
  if (body.note                !== undefined) patch.note                = body.note;

  const { error } = await s.from('field_survey_observations')
    .update(patch).eq('id', body.observation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

