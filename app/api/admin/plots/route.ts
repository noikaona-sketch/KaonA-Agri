import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s   = createServerSupabaseClient();
  const url = new URL(request.url);
  const memberId = url.searchParams.get('member_id') ?? '';

  let q = s.from('plots')
    .select(`
      id, name, area_rai, lat, lng, accuracy, status,
      province, district, sub_district,
      land_doc_type, land_doc_number, description,
      boundary_geojson, area_rai_calculated,
      created_at,
      member:member_id(id, full_name, phone)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (memberId) q = q.eq('member_id', memberId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plots: data ?? [] });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { plot_id, boundary_geojson, area_rai_calculated } =
      (await request.json()) as { plot_id:string; boundary_geojson: object; area_rai_calculated?: number };
    if (!plot_id) return NextResponse.json({ error: 'plot_id required' }, { status: 400 });
    const s = createServerSupabaseClient();
    const { error } = await s.from('plots').update({
      boundary_geojson,
      area_rai_calculated: area_rai_calculated ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', plot_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
