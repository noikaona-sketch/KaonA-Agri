import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

type UserScopedSupabaseClient = ReturnType<typeof createAnonSupabaseClient>;

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  return authorization.replace(/^Bearer\s+/i, '').trim() || null;
}

function createUserScopedSupabaseClient(token: string): UserScopedSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase anon environment variables');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: resolve member row from Bearer token
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCaller(
  request: Request,
  s: UserScopedSupabaseClient,
): Promise<
  | { ok: true;  memberId: string; memberStatus: string }
  | { ok: false; response: ReturnType<typeof NextResponse.json> }
> {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }

  const authClient = createAnonSupabaseClient();
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 }) };
  }

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิกหรือ session ไม่ตรงกับสมาชิกปัจจุบัน' }, { status: 403 }) };
  }

  return { ok: true, memberId: member.id, memberStatus: member.status };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/plot-registration
//
// Accepts multipart/form-data:
//   name, area_rai, lat, lng  — required
//   accuracy, province, description, photo_0..3  — optional
//
// member_id is NEVER read from request body — always from the verified
// auth.uid() -> members.auth_user_id mapping. The insert runs with the caller's
// Bearer token so public.plots RLS remains the database enforcement layer.
//
// Photo handling (per approved scope):
//   1. Upload file to member-photos storage.
//   2. Only on upload success → insert row into public.photos.
//   3. Upload failure → no plot rollback, no photos row, return photo_warnings.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }
    const s = createUserScopedSupabaseClient(token);

    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    if (caller.memberStatus !== 'approved') {
      return NextResponse.json(
        { error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้นที่ลงทะเบียนแปลงได้' },
        { status: 403 },
      );
    }

    // ── Parse form ────────────────────────────────────────────────────────────
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น multipart/form-data)' },
        { status: 400 },
      );
    }

    const name        = (form.get('name')        as string | null)?.trim() ?? '';
    const areaRaiRaw  = (form.get('area_rai')    as string | null) ?? '';
    const latRaw      = (form.get('lat')         as string | null) ?? '';
    const lngRaw      = (form.get('lng')         as string | null) ?? '';
    const accuracyRaw = (form.get('accuracy')    as string | null) ?? '';
    const province    = (form.get('province')    as string | null)?.trim() || null;
    const description = (form.get('description') as string | null)?.trim() || null;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!name) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อแปลง' }, { status: 400 });
    }
    const areaRai = Number(areaRaiRaw);
    if (!Number.isFinite(areaRai) || areaRai <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุพื้นที่ (ไร่) ให้ถูกต้อง' }, { status: 400 });
    }
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return NextResponse.json({ error: 'กรุณาจับพิกัด GPS ก่อนส่งข้อมูล' }, { status: 400 });
    }
    const accuracy = Number(accuracyRaw) || null;

    // ── Insert with the caller's user-scoped session so RLS validates auth.uid()
    //    against members.auth_user_id. member_id is populated from the verified
    //    session mapping only; it is never accepted from form data.
    const insertPayload = {
      member_id:        caller.memberId,
      name,
      area_rai:         areaRai,
      lat,
      lng,
      accuracy,
      land_doc_type:    null,
      land_doc_number:  null,
      province,
      district:         null,
      description,
      status:           'pending_review',
      created_by:       caller.memberId,
      role_used:        'farmer',
      timestamp:        new Date().toISOString(),
    };

    console.info('[PLOT_REG] inserting plot via user-scoped RLS session', {
      member_id: insertPayload.member_id,
      created_by: insertPayload.created_by,
      status: insertPayload.status,
    });

    const { data: insertedPlot, error: insertError } = await s
      .from('plots')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !insertedPlot) {
      console.error('[PLOT_REG] plot insert error:', insertError?.message);
      return NextResponse.json({ error: insertError?.message ?? 'ไม่สามารถสร้างแปลงได้' }, { status: 500 });
    }

    const plotId = insertedPlot.id as string;

    // ── Photo upload + metadata (best-effort per approved scope) ──────────────
    const photoWarnings: string[] = [];
    const capturedAt = new Date().toISOString();

    for (let i = 0; i < 4; i++) {
      const photo = form.get(`photo_${i}`);
      if (!(photo instanceof File) || photo.size === 0) continue;

      const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${caller.memberId}/plots/${plotId}_photo${i}_${Date.now()}.${ext}`;

      // Step 1: upload to storage
      const { error: uploadError } = await s.storage
        .from('member-photos')
        .upload(path, photo, { upsert: true });

      if (uploadError) {
        // Upload failed → no photos row, warn only
        console.warn(`[PLOT_REG] photo ${i} upload failed:`, uploadError.message);
        photoWarnings.push(`photo_${i}: ${uploadError.message}`);
        continue;
      }

      // Step 2: upload succeeded → insert public.photos metadata
      const { error: metaError } = await s.from('photos').insert({
        member_id:    caller.memberId,
        plot_id:      plotId,
        storage_path: path,
        photo_type:   'plot',
        lat,
        lng,
        accuracy:     accuracy ?? 0,
        captured_at:  capturedAt,
        uploaded_by:  caller.memberId,
      });

      if (metaError) {
        // Metadata insert failed — storage file exists but row missing; warn only
        console.warn(`[PLOT_REG] photo ${i} metadata insert failed:`, metaError.message);
        photoWarnings.push(`photo_${i} metadata: ${metaError.message}`);
      }
    }

    return NextResponse.json(
      {
        ok:             true,
        plot_id:        plotId,
        photo_warnings: photoWarnings.length > 0 ? photoWarnings : undefined,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[PLOT_REG] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/member/plot-registration
// Body JSON: { plot_id, name?, area_rai?, description?, province?,
//              lat?, lng?, accuracy? }
//
// Allowed updates (approved scope only):
//   name, area_rai, description, province, lat, lng, accuracy
//
// Protected (never updated here):
//   status, member_id, created_by, role_used, deleted_at, land_doc_number
//
// Guards:
//   - plot belongs to caller (member_id match)
//   - plot status = pending_review
//   - deleted_at is null
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }
    const s = createUserScopedSupabaseClient(token);

    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: {
      plot_id?:     string;
      name?:        string;
      area_rai?:    number;
      description?: string | null;
      province?:    string | null;
      lat?:         number;
      lng?:         number;
      accuracy?:    number | null;
    };

    try {
      body = await request.json() as typeof body;
    } catch {
      return NextResponse.json({ error: 'request body ไม่ถูกต้อง (ต้องเป็น JSON)' }, { status: 400 });
    }

    if (!body.plot_id) {
      return NextResponse.json({ error: 'กรุณาระบุ plot_id' }, { status: 400 });
    }

    // ── Load plot — verify ownership, draft status, not deleted ───────────────
    const { data: existing, error: fetchError } = await s
      .from('plots')
      .select('id, member_id, status, deleted_at')
      .eq('id', body.plot_id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบแปลงที่ต้องการแก้ไข' }, { status: 404 });
    }
    if (existing.member_id !== caller.memberId) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขแปลงนี้' }, { status: 403 });
    }
    if (existing.deleted_at !== null) {
      return NextResponse.json({ error: 'ไม่สามารถแก้ไขแปลงที่ถูกลบแล้ว' }, { status: 409 });
    }
    if (existing.status !== 'pending_review') {
      return NextResponse.json(
        { error: 'แก้ไขได้เฉพาะแปลงสถานะ "รอตรวจสอบ" เท่านั้น' },
        { status: 409 },
      );
    }

    // ── Build patch — only whitelisted fields ─────────────────────────────────
    // Protected fields (status, member_id, created_by, role_used,
    // deleted_at, land_doc_number) are NOT in this object — ever.
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'ชื่อแปลงต้องไม่ว่าง' }, { status: 400 });
      patch.name = name;
    }
    if (body.area_rai !== undefined) {
      if (!Number.isFinite(body.area_rai) || body.area_rai <= 0) {
        return NextResponse.json({ error: 'พื้นที่ต้องมากกว่า 0' }, { status: 400 });
      }
      patch.area_rai = body.area_rai;
    }
    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null;
    }
    if (body.province !== undefined) {
      patch.province = body.province?.trim() || null;
    }
    // GPS fields — UI only sends these when member explicitly recaptured
    if (body.lat !== undefined) {
      if (!Number.isFinite(body.lat)) {
        return NextResponse.json({ error: 'lat ไม่ถูกต้อง' }, { status: 400 });
      }
      patch.lat = body.lat;
    }
    if (body.lng !== undefined) {
      if (!Number.isFinite(body.lng)) {
        return NextResponse.json({ error: 'lng ไม่ถูกต้อง' }, { status: 400 });
      }
      patch.lng = body.lng;
    }
    if (body.accuracy !== undefined) {
      patch.accuracy = body.accuracy;
    }

    // ── Apply update ──────────────────────────────────────────────────────────
    // Double-guard at DB level: re-assert ownership + pending_review + not deleted
    const { error: updateError } = await s
      .from('plots')
      .update(patch)
      .eq('id', body.plot_id)
      .eq('member_id', caller.memberId)
      .eq('status', 'pending_review')
      .is('deleted_at', null);

    if (updateError) {
      console.error('[PLOT_PATCH] update error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plot_id: body.plot_id });
  } catch (e) {
    console.error('[PLOT_PATCH] exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
