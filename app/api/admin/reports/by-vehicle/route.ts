import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/by-vehicle?from=&to=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url  = new URL(request.url);
  const to   = url.searchParams.get('to')   ?? new Date().toISOString().slice(0,10);
  const from = url.searchParams.get('from') ?? new Date(Date.now()-89*86400_000).toISOString().slice(0,10);
  const s    = createServerSupabaseClient();

  // ดึง harvest_bookings + member → ดึง member_vehicles แยก
  const { data: bookings, error } = await s
    .from('harvest_bookings')
    .select(`member_id, scheduled_date, status,
      actual_received_kg, actual_moisture_pct, quality_grade, net_amount`)
    .in('status', ['completed'])
    .gte('scheduled_date', from).lte('scheduled_date', to);

  if (error) return NextResponse.json({ error:error.message }, { status:500 });

  // ดึง vehicles + member info
  const { data: vehicles } = await s
    .from('member_vehicles')
    .select(`id, license_plate, vehicle_type, member_id,
      members!member_vehicles_member_id_fkey(full_name, phone)`);

  type BookingRow = { member_id:string; actual_received_kg:number|null; actual_moisture_pct:number|null; quality_grade:string|null; net_amount:number|null };
  type VehicleRow = { id:string; license_plate:string|null; vehicle_type:string|null; member_id:string; members:{ full_name:string; phone:string|null }|null };

  const bRows = (bookings ?? []) as BookingRow[];
  const vRows = (vehicles ?? []) as unknown as VehicleRow[];

  // group: ต่อ member (1 member อาจมีหลาย vehicle — ใช้ member_id จับคู่)
  const memberMap = new Map(vRows.map(v => [v.member_id, v]));

  const byVehicle: Record<string, {
    license_plate:string; vehicle_type:string|null; driver_name:string;
    trips:number; total_kg:number; total_revenue:number;
    avg_moisture:number; moisture_sum:number; moisture_count:number;
    grade_a:number; grade_b:number; grade_c:number; grade_reject:number;
  }> = {};

  bRows.forEach(b => {
    const v = memberMap.get(b.member_id);
    const key = v?.license_plate ?? b.member_id;
    if (!byVehicle[key]) byVehicle[key] = {
      license_plate: v?.license_plate ?? 'ไม่ระบุ',
      vehicle_type:  v?.vehicle_type  ?? null,
      driver_name:   (v?.members as { full_name:string }|null)?.full_name ?? '—',
      trips:0, total_kg:0, total_revenue:0,
      avg_moisture:0, moisture_sum:0, moisture_count:0,
      grade_a:0, grade_b:0, grade_c:0, grade_reject:0,
    };
    const vd = byVehicle[key]!;
    vd.trips++;
    vd.total_kg      += Number(b.actual_received_kg ?? 0);
    vd.total_revenue += Number(b.net_amount ?? 0);
    if (b.actual_moisture_pct) { vd.moisture_sum += Number(b.actual_moisture_pct); vd.moisture_count++; }
    if (b.quality_grade === 'A') vd.grade_a++;
    else if (b.quality_grade === 'B') vd.grade_b++;
    else if (b.quality_grade === 'C') vd.grade_c++;
    else if (b.quality_grade === 'reject') vd.grade_reject++;
  });

  const rows = Object.values(byVehicle).map(v => ({
    ...v,
    avg_moisture: v.moisture_count > 0 ? Math.round((v.moisture_sum/v.moisture_count)*10)/10 : null,
  })).sort((a,b) => b.total_kg - a.total_kg);

  return NextResponse.json({ from, to, rows });
}
