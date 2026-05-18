import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/plot-registration
//
// Accepts multipart/form-data:
//   name          string  required
//   area_rai      string  required (parsed to numeric)
//   lat           string  required
//   lng           string  required
//   accuracy      string  optional
//   province      string  optional
//   description   string  optional (plotNote)
//   photo_0..3    File    optional (up to 4, bucket: member-photos)
//
// member_id is NEVER read from the body — always resolved from Bearer token.
// RPC add_registration_plot sets status = 'pending_review' internally.
// Photo upload is best-effort: failure does not roll back the plot row.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();

    // ── 1. Resolve caller from Bearer token ───────────────────────────────────
    const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await s.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 });
    }

    const { data: memberRow } = await s
      .from('members')
      .select('id, status')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!memberRow) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 403 });
    }
    if (memberRow.status !== 'approved') {
      return NextResponse.json(
        { error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้นที่ลงทะเบียนแปลงได้' },
        { status: 403 },
      );
    }

    const memberId: string = memberRow.id;

    // ── 2. Parse multipart form ───────────────────────────────────────────────
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น multipart/form-data)' }, { status: 400 });
    }

    const name        = (form.get('name')        as string | null)?.trim() ?? '';
    const areaRaiRaw  = (form.get('area_rai')    as string | null) ?? '';
    const latRaw      = (form.get('lat')         as string | null) ?? '';
    const lngRaw      = (form.get('lng')         as string | null) ?? '';
    const accuracyRaw = (form.get('accuracy')    as string | null) ?? '';
    const province    = (form.get('province')    as string | null)?.trim() || null;
    const description = (form.get('description') as string | null)?.trim() || null;

    // ── 3. Validate required fields ───────────────────────────────────────────
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

    // ── 4. Call add_registration_plot RPC ─────────────────────────────────────
    // RPC is security definer — sets status = 'pending_review' internally.
    // member_id comes only from the resolved session above, never from client.
    const { data: plotId, error: rpcError } = await s.rpc('add_registration_plot', {
      p_member_id:      memberId,
      p_name:           name,
      p_area_rai:       areaRai,
      p_lat:            lat,
      p_lng:            lng,
      p_accuracy:       accuracy,
      p_province:       province,
      p_description:    description,
      p_land_doc_type:  null,
      p_land_doc_number: null,
      p_district:       null,
    });

    if (rpcError) {
      console.error('[PLOT_REG] RPC error:', rpcError.message);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // ── 5. Upload photos (best-effort, up to 4) ───────────────────────────────
    // Reuses bucket + path pattern from register-farmer route.
    // Failure here does NOT roll back the plot row.
    const uploadErrors: string[] = [];
    for (let i = 0; i < 4; i++) {
      const photo = form.get(`photo_${i}`);
      if (!(photo instanceof File) || photo.size === 0) continue;

      const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${memberId}/plots/${plotId}_photo${i}_${Date.now()}.${ext}`;

      const { error: uploadError } = await s.storage
        .from('member-photos')
        .upload(path, photo, { upsert: true });

      if (uploadError) {
        console.warn(`[PLOT_REG] photo ${i} upload failed:`, uploadError.message);
        uploadErrors.push(`photo_${i}: ${uploadError.message}`);
      }
    }

    return NextResponse.json(
      {
        ok:            true,
        plot_id:       plotId as string,
        photo_warnings: uploadErrors.length > 0 ? uploadErrors : undefined,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[PLOT_REG] exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
