import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember } from '../_auth';

// photos(id) gives a count via PostgREST embedded resource.
// public.photos.plot_id FK → plots.id already exists in schema.
const PLOT_SELECT =
  'id,name,area_rai,lat,lng,accuracy,status,province,description,land_doc_type,created_at,' +
  'photos(id)';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/plots
//
// Mode A — Bearer token (preferred): resolves member_id server-side.
// Mode B — ?member_id=<uuid> (legacy, backward-compat): no auth check.
// Mode A takes priority when Authorization header is present.
// ─────────────────────────────────────────────────────────────────────────────
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

// PostgREST returns photos as an array of objects: [{ id: '...' }, ...]
// Normalise to photo_count: number for the client.
function normalisePlots(rows: unknown[] | null) {
  if (!rows) return [];
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const photos = row.photos;
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    const { photos: _photos, ...rest } = row;
    return { ...rest, photo_count: photoCount };
  });
}
