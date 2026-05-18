import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: resolve member row from Bearer token
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<
  | { ok: true;  memberId: string; memberStatus: string }
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

  return { ok: true, memberId: member.id, memberStatus: member.status };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/plot-registration
//
// Accepts multipart/form-data:
//   name, area_rai, lat, lng  — required
//   accuracy, province, description, photo_0..3  — optional
//
// member_id is NEVER read from request body — always from Bearer token.
// RPC add_registration_plot sets status = 'pending_review' internally.
//
// Photo handling (per approved scope):
//   1. Upload file to member-photos storage.
//   2. Only on upload success → insert row into public.photos.
//   3. Upload failure → no plot rollback, no photos row, return photo_warnings.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();

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

    // ── Call RPC (sets status = pending_review internally) ────────────────────
    const { data: plotId, error: rpcError } = await s.rpc('add_registration_plot', {
      p_member_id:       caller.memberId,
      p_name:            name,
      p_area_rai:        areaRai,
      p_lat:             lat,
      p_lng:             lng,
      p_accuracy:        accuracy,
      p_province:        province,
      p_description:     description,
      p_land_doc_type:   null,
      p_land_doc_number: null,
      p_district:        null,
    });

    if (rpcError) {
      console.error('[PLOT_REG] RPC error:', rpcError.message);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // ── Photo upload + metadata (best-effort per approved scope) ──────────────
    const photoWarnings: string[] = [];
    const capturedAt = new Date().toISOString();

    for (let i = 0; i < 4; i++) {
      const photo = form.get(`photo_${i}`);
      if (!(photo instanceof File) || photo.size === 0) continue;

      const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${caller.memberId}/plots/${plotId as string}_photo${i}_${Date.now()}.${ext}`;

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
        plot_id:      plotId as string,
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
        plot_id:        plotId as string,
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
    const s = createServerSupabaseClient();

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
