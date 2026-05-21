import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/no-burn/photos?request_id=xxx
// ดึงรูปหลักฐาน + พิกัด GPS ของคำขอไม่เผา
export async function GET(request: Request) {
  try {
    const _ar = await requireAdminPermission('field.read');
    if (isForbidden(_ar)) return _ar.forbidden;

    const requestId = new URL(request.url).searchParams.get('request_id');
    if (!requestId) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

    const s = createServerSupabaseClient();

    const { data: photos, error } = await s
      .from('photos')
      .select('id,storage_path,lat,lng,accuracy,gps_source,gps_is_mocked,evidence_status,captured_at,gps_distance_to_plot_m')
      .eq('no_burn_request_id', requestId)
      .eq('photo_type', 'no_burn')
      .order('captured_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // สร้าง signed URL สำหรับแต่ละรูป (หมดอายุ 1 ชั่วโมง)
    const bucket = 'member-photos';
    const items = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await s.storage
          .from(bucket)
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, signed_url: signed?.signedUrl ?? null };
      }),
    );

    return NextResponse.json({ photos: items });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// PATCH /api/admin/no-burn/photos
// อัปเดต evidence_status ของรูป (accepted | rejected | needs_review)
export async function PATCH(request: Request) {
  try {
    const _ar = await requireAdminPermission('field.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const { photo_id, evidence_status } = (await request.json()) as {
      photo_id: string;
      evidence_status: 'accepted' | 'rejected' | 'needs_review';
    };
    if (!photo_id || !evidence_status)
      return NextResponse.json({ error: 'photo_id and evidence_status required' }, { status: 400 });

    const s = createServerSupabaseClient();
    const { error } = await s.from('photos')
      .update({ evidence_status, reviewed_at: new Date().toISOString() })
      .eq('id', photo_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
