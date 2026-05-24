import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/system-metrics
// คำนวณ % ความพร้อมของแต่ละระบบจากข้อมูลจริงใน DB
export async function GET() {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const s = createServerSupabaseClient();

  try {
    // ดึงทุก metric พร้อมกัน
  const [
    membersRes, approvedRes, plotsRes, cyclesRes,
    bookingsRes, completedRes, noBurnRes, noBurnApprovedRes,
    inspectionsRes, inspCompletedRes, productsRes,
    slotRes, vehicleRes, campaignRes,
  ] = await Promise.all([
    s.from('members').select('id', { count:'exact', head:true }),
    s.from('members').select('id', { count:'exact', head:true }).eq('status','approved'),
    s.from('plots').select('id', { count:'exact', head:true }),
    s.from('planting_cycles').select('id', { count:'exact', head:true }),
    s.from('harvest_bookings').select('id', { count:'exact', head:true }),
    s.from('harvest_bookings').select('id', { count:'exact', head:true }).eq('status','completed'),
    s.from('no_burn_requests').select('id', { count:'exact', head:true }),
    s.from('no_burn_requests').select('id', { count:'exact', head:true }).eq('status','approved'),
    s.from('inspections').select('id', { count:'exact', head:true }),
    s.from('inspections').select('id', { count:'exact', head:true }).in('result_status',['passed','failed','needs_update']),
    s.from('products').select('id', { count:'exact', head:true }),
    s.from('pickup_slots').select('id', { count:'exact', head:true }).eq('status','open'),
    s.from('member_vehicles').select('id', { count:'exact', head:true }),
    s.from('campaign_announcements').select('id', { count:'exact', head:true }).eq('is_active',true),
  ]);

  const total_members     = membersRes.count    ?? 0;
  const approved_members  = approvedRes.count   ?? 0;
  const total_plots       = plotsRes.count       ?? 0;
  const total_cycles      = cyclesRes.count      ?? 0;
  const total_bookings    = bookingsRes.count    ?? 0;
  const completed_intakes = completedRes.count   ?? 0;
  const total_noburn      = noBurnRes.count      ?? 0;
  const approved_noburn   = noBurnApprovedRes.count ?? 0;
  const total_inspect     = inspectionsRes.count ?? 0;
  const done_inspect      = inspCompletedRes.count ?? 0;
  const total_products    = productsRes.count    ?? 0;
  const open_slots        = slotRes.count        ?? 0;
  const total_vehicles    = vehicleRes.count     ?? 0;
  const active_campaigns  = campaignRes.count    ?? 0;

  // คำนวณ activity score (มีข้อมูลจริงใช้งานแล้ว)
  const hasIntake   = completed_intakes > 0;
  const hasNoburn   = total_noburn > 0;
  const hasInspect  = total_inspect > 0;
  const hasProducts = total_products > 0;
  const hasSlots    = open_slots > 0;
  const hasVehicles = total_vehicles > 0;
  const hasCampaign = active_campaigns > 0;

  // activity flags — ใช้แสดงว่าระบบเริ่มใช้งานจริงแล้วไหม
    return NextResponse.json({
      as_of: new Date().toISOString(),
      metrics: {
        total_members, approved_members,
        total_plots, total_cycles,
        total_bookings, completed_intakes,
        total_noburn, approved_noburn,
        total_inspect, done_inspect,
        total_products, open_slots,
        total_vehicles, active_campaigns,
      },
      activity: {
        member_active:   approved_members > 0,
        plot_active:     total_plots > 0,
        booking_active:  total_bookings > 0,
        intake_active:   hasIntake,
        noburn_active:   hasNoburn,
        inspect_active:  hasInspect,
        seed_active:     hasProducts,
        slot_active:     hasSlots,
        truck_active:    hasVehicles,
        campaign_active: hasCampaign,
      },
    });
  } catch (e) {
    // ถ้า table ยังไม่มี (migration ยังไม่ run) → คืน zeros แทน crash
    console.error('[system-metrics] DB error:', e);
    const zero = { total_members:0, approved_members:0, total_plots:0, total_cycles:0, total_bookings:0, completed_intakes:0, total_noburn:0, approved_noburn:0, total_inspect:0, done_inspect:0, total_products:0, open_slots:0, total_vehicles:0, active_campaigns:0 };
    const falseActivity = { member_active:false, plot_active:false, booking_active:false, intake_active:false, noburn_active:false, inspect_active:false, seed_active:false, slot_active:false, truck_active:false, campaign_active:false };
    return NextResponse.json({ as_of: new Date().toISOString(), metrics: zero, activity: falseActivity, error: String(e) });
  }
}
