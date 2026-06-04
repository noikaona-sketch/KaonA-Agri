import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/plot-registration
//
// Uses the same resolveApprovedMember pattern as planting-cycles to ensure
// consistent member resolution on LINE mobile.
//
// Accepts multipart/form-data:
//   name, area_rai         — required
//   province, description  — optional
//   lat, lng, accuracy     — optional (GPS disabled for now; pass null or omit)
//   photo_0..3             — optional
//
// member_id is NEVER read from the request body — always resolved from Bearer
// token (if present) or line_user_id / member_id query param fallback.
//
// Diagnostic logs compare:
//   - add-plot resolved member_id
//   - auth.uid() at insert time
//   - current_member_id() at insert time
//   - insert member_id
//   - created_by
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();

    // ── Resolve member — same pattern as planting-cycles ─────────────────────
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

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
    const landDocType = (form.get('land_doc_type')   as string | null)?.trim() || null;
    const landDocNum  = (form.get('land_doc_number') as string | null)?.trim() || null;

    // ── Validate required fields ───────────────────────────────────────────────
    if (!name) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อแปลง' }, { status: 400 });
    }
    const areaRai = Number(areaRaiRaw);
    if (!Number.isFinite(areaRai) || areaRai <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุพื้นที่ (ไร่) ให้ถูกต้อง' }, { status: 400 });
    }

    // ── GPS: optional while disabled ──────────────────────────────────────────
    // lat/lng may be null or missing — skip GPS validation when values absent
    const lat      = latRaw      ? Number(latRaw)      : null;
    const lng      = lngRaw      ? Number(lngRaw)      : null;
    const accuracy = accuracyRaw ? Number(accuracyRaw) : null;

    // If lat/lng provided they must be valid finite numbers
    if (lat !== null && !Number.isFinite(lat)) {
      return NextResponse.json({ error: 'lat ไม่ถูกต้อง' }, { status: 400 });
    }
    if (lng !== null && !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lng ไม่ถูกต้อง' }, { status: 400 });
    }

    // ── Diagnostic: compare auth state before insert ──────────────────────────
    const [authResult, memberIdResult] = await Promise.all([
      s.auth.getUser(),
      s.rpc('current_member_id'),
    ]);

    console.log('[ADD_PLOT] pre-insert diagnostics', {
      'add-plot resolved member_id': caller.memberId,
      'auth.uid()': authResult.data?.user?.id ?? null,
      'auth.getUser() error': authResult.error?.message ?? null,
      'current_member_id()': (memberIdResult.data as string | null) ?? null,
      'current_member_id() error': memberIdResult.error?.message ?? null,
      'insert member_id (will use)': caller.memberId,
      'insert created_by (will use)': caller.memberId,
    });

    // ── Call RPC (sets status = pending_review internally, SECURITY DEFINER) ──
    const { data: plotId, error: rpcError } = await s.rpc('add_registration_plot', {
      p_member_id:       caller.memberId,
      p_name:            name,
      p_area_rai:        areaRai,
      p_lat:             lat,
      p_lng:             lng,
      p_accuracy:        accuracy,
      p_province:        province,
      p_description:     description,
      p_land_doc_type:   landDocType,
      p_land_doc_number: landDocNum,
      p_district:        null,
    });

    if (rpcError) {
      console.error('[ADD_PLOT] RPC error:', rpcError.message, {
        memberId: caller.memberId,
        rpcCode: rpcError.code,
        rpcHint: rpcError.hint,
        rpcDetails: rpcError.details,
      });
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    console.log('[ADD_PLOT] insert success', {
      plotId: plotId as string,
      memberId: caller.memberId,
    });

    // ── Photo upload + metadata (best-effort) ─────────────────────────────────
    const photoWarnings: string[] = [];
    const capturedAt = new Date().toISOString();

    for (let i = 0; i < 4; i++) {
      const photo = form.get(`photo_${i}`);
      if (!(photo instanceof File) || photo.size === 0) continue;

      const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${caller.memberId}/plots/${plotId as string}_photo${i}_${Date.now()}.${ext}`;

      const { error: uploadError } = await s.storage
        .from('member-photos')
        .upload(path, photo, { upsert: true });

      if (uploadError) {
        console.warn(`[ADD_PLOT] photo ${i} upload failed:`, uploadError.message);
        photoWarnings.push(`photo_${i}: ${uploadError.message}`);
        continue;
      }

      const { error: metaError } = await s.from('photos').insert({
        member_id:    caller.memberId,
        plot_id:      plotId as string,
        storage_path: path,
        photo_type:   'plot',
        lat:          lat ?? 0,
        lng:          lng ?? 0,
        accuracy:     accuracy ?? 0,
        captured_at:  capturedAt,
        uploaded_by:  caller.memberId,
      });

      if (metaError) {
        console.warn(`[ADD_PLOT] photo ${i} metadata insert failed:`, metaError.message);
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
    console.error('[ADD_PLOT] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/member/plot-registration
// (unchanged — kept as is, still uses local resolveCaller for Bearer-only auth)
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

export async function PATCH(request: Request) {
  try {
    const s = createServerSupabaseClient();

    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

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
