import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Shared: resolve member from Bearer token
// ─────────────────────────────────────────────────────────────────────────────
import { resolveApprovedMember } from '../_auth';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/no-burn
//
// Accepts multipart/form-data:
//   plot_id           string   required
//   consent_accepted  string   required — must be 'true'
//   season_id         string   optional — รอบโครงการไม่เผา
//   planting_cycle_id string   optional
//   note              string   optional
//   lat               string   optional (GPS at time of request)
//   lng               string   optional
//   accuracy          string   optional
//   photo_0..3        File     optional (uploaded to member-photos bucket)
//
// member_id may be passed in form data as fallback when token is expired.
// Photo failure does NOT roll back the no_burn_request row.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();

    // ── Parse multipart form ──────────────────────────────────────────────────
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น multipart/form-data)' },
        { status: 400 },
      );
    }

    // ── Resolve member (token first, then member_id from form) ────────────────
    const formMemberId = (form.get('member_id') as string | null)?.trim() || undefined;
    const caller = await resolveApprovedMember(request, s, formMemberId);
    if (!caller.ok) return caller.response;

    const plotId          = (form.get('plot_id')           as string | null)?.trim() ?? '';
    const consentRaw      = (form.get('consent_accepted')  as string | null) ?? '';
    const plantingCycleId = (form.get('planting_cycle_id') as string | null)?.trim() || null;
    const seasonId        = (form.get('season_id')          as string | null)?.trim() || null;
    const note            = (form.get('note')              as string | null)?.trim() || null;
    const timingRaw       = (form.get('timing')            as string | null)?.trim() || null;
    const timing          = (timingRaw === 'before_planting' || timingRaw === 'after_planting')
                              ? timingRaw
                              : 'after_planting';
    const latRaw          = (form.get('lat')               as string | null) ?? '';
    const lngRaw          = (form.get('lng')               as string | null) ?? '';
    const accuracyRaw     = (form.get('accuracy')          as string | null) ?? '';

    // ── Validate consent (required) ───────────────────────────────────────────
    if (consentRaw !== 'true') {
      return NextResponse.json(
        { error: 'ต้องยืนยันความยินยอมก่อนยื่นคำของดเผา' },
        { status: 400 },
      );
    }

    // ── Validate plot_id (required + ownership) ───────────────────────────────
    if (!plotId) {
      return NextResponse.json({ error: 'กรุณาเลือกแปลง' }, { status: 400 });
    }

    const { data: plotRow } = await s
      .from('plots')
      .select('id, member_id, deleted_at')
      .eq('id', plotId)
      .maybeSingle();

    if (!plotRow || plotRow.deleted_at !== null) {
      return NextResponse.json({ error: 'ไม่พบแปลงที่เลือก' }, { status: 404 });
    }
    if (plotRow.member_id !== caller.memberId) {
      // Reject plot owned by another member
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้แปลงนี้' }, { status: 403 });
    }

    const lat      = Number(latRaw)      || null;
    const lng      = Number(lngRaw)      || null;
    const accuracy = Number(accuracyRaw) || null;

    // ── Insert no_burn_request ─────────────────────────────────────────────────
    const { data: newRequest, error: insertError } = await s
      .from('no_burn_requests')
      .insert({
        member_id:         caller.memberId,
        plot_id:           plotId,
        planting_cycle_id: plantingCycleId,
        season_id:         seasonId,
        timing,
        status:            'submitted',
        consent_accepted:  true,
        note,
        submitted_at:      new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !newRequest) {
      console.error('[NO_BURN] insert error:', insertError?.message);
      return NextResponse.json({ error: insertError?.message ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });
    }

    const requestId = newRequest.id as string;

    // ── Photo upload + metadata (best-effort, same pattern as plot-registration) ─
    const photoWarnings: string[] = [];
    const capturedAt = new Date().toISOString();

    for (let i = 0; i < 4; i++) {
      const photo = form.get(`photo_${i}`);
      if (!(photo instanceof File) || photo.size === 0) continue;

      const ext  = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${caller.memberId}/no-burn/${requestId}_photo${i}_${Date.now()}.${ext}`;

      // Step 1: upload to storage
      const { error: uploadError } = await s.storage
        .from('member-photos')
        .upload(path, photo, { upsert: true });

      if (uploadError) {
        console.warn(`[NO_BURN] photo ${i} upload failed:`, uploadError.message);
        photoWarnings.push(`photo_${i}: ${uploadError.message}`);
        continue;
      }

      // Step 2: only on upload success — insert public.photos metadata
      const { error: metaError } = await s.from('photos').insert({
        member_id:          caller.memberId,
        no_burn_request_id: requestId,
        plot_id:            plotId,
        storage_path:       path,
        photo_type:         'no_burn',
        evidence_status:    'submitted',
        lat:                lat ?? null,
        lng:                lng ?? null,
        accuracy:           accuracy ?? null,
        captured_at:        capturedAt,
        uploaded_by:        caller.memberId,
      });

      if (metaError) {
        console.warn(`[NO_BURN] photo ${i} metadata failed:`, metaError.message);
        photoWarnings.push(`photo_${i} metadata: ${metaError.message}`);
      }
    }

    return NextResponse.json(
      {
        ok:             true,
        request_id:     requestId,
        photo_warnings: photoWarnings.length > 0 ? photoWarnings : undefined,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[NO_BURN] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/no-burn
// Returns caller's own no_burn_requests, newest first.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const qMemberId = new URL(request.url).searchParams.get('member_id') ?? undefined;
    const caller = await resolveApprovedMember(request, s, qMemberId);
    if (!caller.ok) return caller.response;

    const { data, error } = await s
      .from('no_burn_requests')
      .select(
        'id, status, timing, submitted_at, review_note, consent_accepted, note, ' +
        'plot_id, planting_cycle_id, ' +
        'plots(name, province), ' +
        'planting_cycles(crop_name, season_year)',
      )
      .eq('member_id', caller.memberId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[NO_BURN] GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    console.error('[NO_BURN] GET exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
