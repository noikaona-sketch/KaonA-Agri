import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

const PLOT_SELECT =
  'id,name,area_rai,lat,lng,accuracy,status,province,district,subdistrict,village,description,land_doc_type,created_at,' +
  'photos(id)';

export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

    const { data, error } = await s
      .from('plots')
      .select(PLOT_SELECT)
      .eq('member_id', caller.memberId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plots: normalisePlots(data) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── PATCH /api/member/plots ───────────────────────────────────────────────────
// Edit own plot — only allowed when status = pending_review
export async function PATCH(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      plot_id:          string;
      name?:            string;
      area_rai?:        number;
      province?:        string | null;
      district?:        string | null;
      subdistrict?:     string | null;
      village?:         string | null;
      land_doc_type?:   string | null;
      land_doc_number?: string | null;
      description?:     string | null;
    };

    if (!body.plot_id) return NextResponse.json({ error: 'กรุณาระบุ plot_id' }, { status: 400 });

    // Verify ownership + status
    const { data: existing } = await s.from('plots')
      .select('id, member_id, status, deleted_at')
      .eq('id', body.plot_id)
      .maybeSingle();

    if (!existing)                          return NextResponse.json({ error: 'ไม่พบแปลง' },                                  { status: 404 });
    if (existing.member_id !== caller.memberId) return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขแปลงนี้' },            { status: 403 });
    if (existing.deleted_at)                return NextResponse.json({ error: 'ไม่สามารถแก้ไขแปลงที่ถูกลบแล้ว' },          { status: 409 });
    if (existing.status !== 'pending_review') return NextResponse.json({ error: 'แก้ไขได้เฉพาะแปลงสถานะ "รอตรวจสอบ"' }, { status: 409 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'ชื่อแปลงต้องไม่ว่าง' }, { status: 400 });
      patch.name = body.name.trim();
    }
    if (body.area_rai !== undefined) {
      if (!Number.isFinite(body.area_rai) || body.area_rai <= 0)
        return NextResponse.json({ error: 'พื้นที่ต้องมากกว่า 0' }, { status: 400 });
      patch.area_rai = body.area_rai;
    }
    if (body.province     !== undefined) patch.province     = body.province?.trim()     || null;
    if (body.district     !== undefined) patch.district     = body.district?.trim()     || null;
    if (body.subdistrict  !== undefined) patch.subdistrict  = body.subdistrict?.trim()  || null;
    if (body.village      !== undefined) patch.village      = body.village?.trim()      || null;
    if (body.land_doc_type   !== undefined) patch.land_doc_type   = body.land_doc_type   || null;
    if (body.land_doc_number !== undefined) patch.land_doc_number = body.land_doc_number?.trim() || null;
    if (body.description     !== undefined) patch.description     = body.description?.trim()     || null;

    const { error } = await s.from('plots').update(patch)
      .eq('id', body.plot_id)
      .eq('member_id', caller.memberId)
      .eq('status', 'pending_review')
      .is('deleted_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── DELETE /api/member/plots ──────────────────────────────────────────────────
// Soft delete own plot — allowed at any status
// Body: { plot_id: string }
export async function DELETE(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

    const { plot_id } = (await request.json()) as { plot_id?: string };
    if (!plot_id) return NextResponse.json({ error: 'กรุณาระบุ plot_id' }, { status: 400 });

    // Verify ownership
    const { data: existing } = await s.from('plots')
      .select('id, member_id, deleted_at')
      .eq('id', plot_id)
      .maybeSingle();

    if (!existing)                              return NextResponse.json({ error: 'ไม่พบแปลง' },               { status: 404 });
    if (existing.member_id !== caller.memberId) return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบแปลงนี้' }, { status: 403 });
    if (existing.deleted_at)                    return NextResponse.json({ error: 'แปลงนี้ถูกลบแล้ว' },       { status: 409 });

    const { error } = await s.from('plots').update({
      deleted_at: new Date().toISOString(),
      deleted_by: caller.memberId,
      updated_at: new Date().toISOString(),
    }).eq('id', plot_id).eq('member_id', caller.memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function normalisePlots(rows: unknown[] | null) {
  if (!rows) return [];
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const photos = row.photos;
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    const { photos: _photos, ...rest } = row;
    return { ...rest, photo_count: photoCount };
  });
}
