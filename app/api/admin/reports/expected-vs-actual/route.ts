import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/expected-vs-actual?from=&to=&location_id=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url        = new URL(request.url);
  const to         = url.searchParams.get('to')   ?? new Date().toISOString().slice(0, 10);
  const from       = url.searchParams.get('from') ?? new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const locationId = url.searchParams.get('location_id');
  const s          = createServerSupabaseClient();

  let q = s.from('harvest_bookings')
    .select(`id, scheduled_date, status, intake_source,
      estimated_tonnage, actual_received_kg,
      estimated_moisture, actual_moisture_pct,
      net_weight_kg, net_amount, quality_grade,
      members!harvest_bookings_member_id_fkey(full_name, phone),
      pickup_locations!harvest_bookings_intake_location_id_fkey(name)`)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .not('status', 'in', '("cancelled","no_show")')
    .order('scheduled_date', { ascending: false });

  if (locationId) q = q.eq('intake_location_id', locationId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = typeof data extends (infer T)[] | null ? T : never;
  const rows = (data ?? []) as Row[];

  // คำนวณสรุป
  const completed = rows.filter(r => r.status === 'completed' && r.actual_received_kg);
  const totalExpectedKg = completed.reduce((s, r) => s + (Number(r.estimated_tonnage ?? 0) * 1000), 0);
  const totalActualKg   = completed.reduce((s, r) => s + Number(r.actual_received_kg ?? 0), 0);
  const totalRevenue    = completed.reduce((s, r) => s + Number(r.net_amount ?? 0), 0);

  const avgMoistureExp = completed.length > 0
    ? completed.reduce((s, r) => s + Number(r.estimated_moisture ?? 0), 0) / completed.length
    : null;
  const avgMoistureAct = completed.filter(r => r.actual_moisture_pct).length > 0
    ? completed.filter(r => r.actual_moisture_pct).reduce((s, r) => s + Number(r.actual_moisture_pct), 0) / completed.filter(r => r.actual_moisture_pct).length
    : null;

  const accuracyPct = totalExpectedKg > 0
    ? Math.round((totalActualKg / totalExpectedKg) * 100)
    : null;

  return NextResponse.json({
    from, to,
    summary: {
      total_bookings:    rows.length,
      completed:         completed.length,
      total_expected_kg: totalExpectedKg,
      total_actual_kg:   totalActualKg,
      accuracy_pct:      accuracyPct,
      avg_moisture_exp:  avgMoistureExp ? Math.round(avgMoistureExp * 10) / 10 : null,
      avg_moisture_act:  avgMoistureAct ? Math.round(avgMoistureAct * 10) / 10 : null,
      total_revenue:     totalRevenue,
    },
    rows,
  });
}
