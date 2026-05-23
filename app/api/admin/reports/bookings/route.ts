import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/bookings?from=&to=&location_id=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url        = new URL(request.url);
  const to         = url.searchParams.get('to')   ?? new Date().toISOString().slice(0,10);
  const from       = url.searchParams.get('from') ?? new Date(Date.now()-29*86400_000).toISOString().slice(0,10);
  const locationId = url.searchParams.get('location_id');
  const s          = createServerSupabaseClient();

  let q = s.from('harvest_bookings')
    .select(`id, scheduled_date, status, drying_preference,
      estimated_tonnage, actual_received_kg, net_amount,
      members!harvest_bookings_member_id_fkey(full_name),
      pickup_locations!harvest_bookings_intake_location_id_fkey(name)`)
    .gte('scheduled_date', from).lte('scheduled_date', to)
    .order('scheduled_date', { ascending:false });
  if (locationId) q = q.eq('intake_location_id', locationId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error:error.message }, { status:500 });

  type Row = typeof data extends (infer T)[]|null ? T : never;
  const rows = (data ?? []) as Row[];

  // รวมตามวัน
  const byDay: Record<string, { date:string; total:number; completed:number; no_show:number; cancelled:number; expected_kg:number; actual_kg:number; revenue:number }> = {};
  rows.forEach(r => {
    const d = r.scheduled_date as string;
    if (!byDay[d]) byDay[d] = { date:d, total:0, completed:0, no_show:0, cancelled:0, expected_kg:0, actual_kg:0, revenue:0 };
    byDay[d].total++;
    if (r.status === 'completed') byDay[d].completed++;
    if (r.status === 'no_show')   byDay[d].no_show++;
    if (r.status === 'cancelled') byDay[d].cancelled++;
    byDay[d].expected_kg += Number(r.estimated_tonnage ?? 0) * 1000;
    byDay[d].actual_kg   += Number(r.actual_received_kg ?? 0);
    byDay[d].revenue     += Number(r.net_amount ?? 0);
  });

  const daily = Object.values(byDay).sort((a,b) => b.date.localeCompare(a.date));
  const completedRows = rows.filter(r => r.status === 'completed');

  return NextResponse.json({
    from, to,
    summary: {
      total:         rows.length,
      completed:     completedRows.length,
      no_show:       rows.filter(r => r.status==='no_show').length,
      cancelled:     rows.filter(r => r.status==='cancelled').length,
      dryer_req:     rows.filter(r => r.drying_preference==='required').length,
      total_actual_kg:  completedRows.reduce((s,r) => s+Number(r.actual_received_kg??0), 0),
      total_revenue:    completedRows.reduce((s,r) => s+Number(r.net_amount??0), 0),
    },
    daily,
    rows,
  });
}
