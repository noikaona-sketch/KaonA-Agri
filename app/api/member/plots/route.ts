import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

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
    const { searchParams } = new URL(request.url);

    const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();

    if (token) {
      // ── Mode A ──────────────────────────────────────────────────────────────
      const { data: { user }, error: userError } = await s.auth.getUser(token);
      if (userError || !user) {
        return NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 });
      }

      const { data: memberRow } = await s
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!memberRow) return NextResponse.json({ plots: [] });

      const { data, error } = await s
        .from('plots')
        .select(PLOT_SELECT)
        .eq('member_id', memberRow.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ plots: normalisePlots(data) });
    }

    // ── Mode B: legacy query-param ────────────────────────────────────────────
    const memberId = searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ plots: [] });

    const { data, error } = await s
      .from('plots')
      .select(PLOT_SELECT)
      .eq('member_id', memberId)
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
