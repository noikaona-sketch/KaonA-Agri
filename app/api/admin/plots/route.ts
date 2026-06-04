import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

const PLOT_SELECT = `
  id, name, area_rai, lat, lng, accuracy, status,
  province, district, subdistrict, village,
  land_doc_type, land_doc_number, description,
  boundary_geojson, area_rai_calculated,
  created_at, updated_at,
  member:member_id(id, full_name, phone)
`;

// ── GET /api/admin/plots ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const s   = createServerSupabaseClient();
  const url = new URL(request.url);
  const memberId = url.searchParams.get('member_id') ?? '';

  let q = s.from('plots')
    .select(PLOT_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (memberId) q = q.eq('member_id', memberId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plots: data ?? [] });
}

// ── POST /api/admin/plots ─────────────────────────────────────────────────────
// Admin creates a plot for any approved member
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      member_id:     string;
      name:          string;
      area_rai:      number;
      lat?:          number | null;
      lng?:          number | null;
      accuracy?:     number | null;
      province?:     string | null;
      district?:     string | null;
      subdistrict?:  string | null;
      village?:      string | null;
      land_doc_type?:   string | null;
      land_doc_number?: string | null;
      description?:  string | null;
      status?:       string;
    };

    if (!body.member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!body.area_rai || body.area_rai <= 0) return NextResponse.json({ error: 'area_rai must be > 0' }, { status: 400 });

    const s = createServerSupabaseClient();

    // Verify member exists and is approved
    const { data: member } = await s.from('members')
      .select('id, status, full_name')
      .eq('id', body.member_id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
    if (member.status !== 'approved') return NextResponse.json({ error: `สมาชิกยังไม่ได้รับอนุมัติ (status: ${member.status})` }, { status: 400 });

    const { data: plot, error } = await s.from('plots').insert({
      member_id:       body.member_id,
      name:            body.name.trim(),
      area_rai:        body.area_rai,
      lat:             body.lat  ?? 0,
      lng:             body.lng  ?? 0,
      accuracy:        body.accuracy  ?? null,
      province:        body.province?.trim()     || null,
      district:        body.district?.trim()     || null,
      subdistrict:     body.subdistrict?.trim()  || null,
      village:         body.village?.trim()      || null,
      land_doc_type:   body.land_doc_type        || null,
      land_doc_number: body.land_doc_number?.trim() || null,
      description:     body.description?.trim()  || null,
      status:          body.status ?? 'active',   // admin-created = active immediately
      created_by:      body.member_id,
      role_used:       'admin',
      timestamp:       new Date().toISOString(),
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, plot_id: (plot as { id: string }).id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── PATCH /api/admin/plots ────────────────────────────────────────────────────
// Admin edits any field on any plot
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      plot_id:          string;
      name?:            string;
      area_rai?:        number;
      lat?:             number | null;
      lng?:             number | null;
      accuracy?:        number | null;
      province?:        string | null;
      district?:        string | null;
      subdistrict?:     string | null;
      village?:         string | null;
      land_doc_type?:   string | null;
      land_doc_number?: string | null;
      description?:     string | null;
      status?:          string;
      boundary_geojson?:    object | null;
      area_rai_calculated?: number | null;
    };

    if (!body.plot_id) return NextResponse.json({ error: 'plot_id required' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'ชื่อแปลงต้องไม่ว่าง' }, { status: 400 });
      patch.name = body.name.trim();
    }
    if (body.area_rai !== undefined) {
      if (body.area_rai <= 0) return NextResponse.json({ error: 'area_rai must be > 0' }, { status: 400 });
      patch.area_rai = body.area_rai;
    }
    if (body.lat          !== undefined) patch.lat          = body.lat;
    if (body.lng          !== undefined) patch.lng          = body.lng;
    if (body.accuracy     !== undefined) patch.accuracy     = body.accuracy;
    if (body.province     !== undefined) patch.province     = body.province?.trim()     || null;
    if (body.district     !== undefined) patch.district     = body.district?.trim()     || null;
    if (body.subdistrict  !== undefined) patch.subdistrict  = body.subdistrict?.trim()  || null;
    if (body.village      !== undefined) patch.village      = body.village?.trim()      || null;
    if (body.land_doc_type   !== undefined) patch.land_doc_type   = body.land_doc_type   || null;
    if (body.land_doc_number !== undefined) patch.land_doc_number = body.land_doc_number?.trim() || null;
    if (body.description     !== undefined) patch.description     = body.description?.trim()     || null;
    if (body.status          !== undefined) patch.status          = body.status;
    if (body.boundary_geojson    !== undefined) patch.boundary_geojson    = body.boundary_geojson;
    if (body.area_rai_calculated !== undefined) patch.area_rai_calculated = body.area_rai_calculated;

    const s = createServerSupabaseClient();
    const { error } = await s.from('plots').update(patch).eq('id', body.plot_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
