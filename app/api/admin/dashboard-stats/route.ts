import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  try {
    const s = createServerSupabaseClient();

    const [
      membersRes, pendingRes, plotsRes,
      ordersRes,  reservationsRes, stockAlerts,
      salesSummary, appointmentsRes,
    ] = await Promise.all([
      // จำนวนสมาชิกทั้งหมด
      s.from('members').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      // รออนุมัติ
      s.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      // แปลงทั้งหมด
      s.from('plots').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      // คำสั่งซื้อ 30 วัน
      s.from('sale_orders').select('id,total', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .eq('status', 'completed'),
      // การจองเมล็ดรอดำเนินการ
      s.from('seed_reservations').select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed']),
      // สต๊อกต่ำ
      s.from('seed_stock_lots').select('id', { count: 'exact', head: true })
        .eq('status', 'low'),
      // ยอดขาย 30 วัน
      s.rpc('get_sales_summary').single(),
      // นัดขาย 30 วัน
      s.from('sale_appointments').select('id', { count: 'exact', head: true })
        .gte('appointment_date', new Date().toISOString().slice(0, 10))
        .in('status', ['scheduled', 'confirmed']),
    ]);

    // คำนวณรายได้ 30 วัน
    const revenue30d = (ordersRes.data ?? []).reduce(
      (sum: number, o: { total: number }) => sum + (o.total ?? 0), 0
    );

    return NextResponse.json({
      members_approved:     membersRes.count ?? 0,
      members_pending:      pendingRes.count ?? 0,
      plots_total:          plotsRes.count ?? 0,
      orders_30d:           ordersRes.count ?? 0,
      revenue_30d:          revenue30d,
      reservations_pending: reservationsRes.count ?? 0,
      stock_low_count:      stockAlerts.count ?? 0,
      appointments_upcoming: appointmentsRes.count ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
