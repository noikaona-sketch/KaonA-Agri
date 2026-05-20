import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../members/_admin-auth';

type AlertCandidate = {
  key: 'active_campaign_ready' | 'harvest_queue_pressure' | 'pest_survey_signal' | 'no_burn_campaign_active';
  title: string;
  readiness: 'ready' | 'watch';
  notSentLabel: string;
  preview: string;
  detail: string;
  count: number;
};

export async function GET() {
  try {
    const auth = await requireAdminPermission('reports.read');
    if (isForbidden(auth)) return auth.forbidden;

    const s = createServerSupabaseClient();
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString();

    const [
      activeCyclesRes,
      pendingHarvestRes,
      issueProgressRes,
      noBurnActiveRes,
    ] = await Promise.all([
      s.from('planting_cycles').select('id', { count: 'exact', head: true }).in('status', ['planned', 'growing']),
      s.from('harvest_bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed']),
      s.from('planting_cycle_progress')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'issue')
        .gte('recorded_at', sevenDaysAgo),
      s.from('no_burn_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['submitted', 'under_review', 'inspection_required'])
        .is('deleted_at', null),
    ]);

    const activeCycles = activeCyclesRes.count ?? 0;
    const pendingHarvest = pendingHarvestRes.count ?? 0;
    const pestSignal = issueProgressRes.count ?? 0;
    const noBurnActive = noBurnActiveRes.count ?? 0;

    const candidates: AlertCandidate[] = [
      {
        key: 'active_campaign_ready',
        title: 'Active campaign ready to notify',
        readiness: activeCycles > 0 ? 'ready' : 'watch',
        notSentLabel: 'NOT SENT (preview only)',
        preview: `แจ้งเตือนเตรียมฤดูกาล: มีรอบปลูกที่กำลังดำเนินการ ${activeCycles} รอบ โปรดตรวจสอบความพร้อมก่อนประกาศแจ้งสมาชิก`,
        detail: 'Derived from active planting cycles (planned/growing).',
        count: activeCycles,
      },
      {
        key: 'harvest_queue_pressure',
        title: 'Harvest queue pressure',
        readiness: pendingHarvest >= 10 ? 'ready' : 'watch',
        notSentLabel: 'NOT SENT (preview only)',
        preview: `แจ้งเตือนคิวรถเกี่ยว: มีงานค้างในคิว ${pendingHarvest} รายการ ควรวางแผนทีมและรถล่วงหน้า`,
        detail: 'Derived from harvest bookings in pending/confirmed statuses.',
        count: pendingHarvest,
      },
      {
        key: 'pest_survey_signal',
        title: 'Pest survey signal',
        readiness: pestSignal > 0 ? 'ready' : 'watch',
        notSentLabel: 'NOT SENT (preview only)',
        preview: `สัญญาณสำรวจศัตรูพืช: พบรายงานปัญหาระยะ 7 วันล่าสุด ${pestSignal} รายการ โปรดตรวจสอบภาคสนาม`,
        detail: 'Proxy via planting progress stage="issue" in last 7 days.',
        count: pestSignal,
      },
      {
        key: 'no_burn_campaign_active',
        title: 'No-burn campaign active',
        readiness: noBurnActive > 0 ? 'ready' : 'watch',
        notSentLabel: 'NOT SENT (preview only)',
        preview: `โครงการงดเผากำลังดำเนินการ: มีคำขอที่ยังอยู่ระหว่างดำเนินการ ${noBurnActive} รายการ`,
        detail: 'Derived from active no-burn requests queue.',
        count: noBurnActive,
      },
    ];

    return NextResponse.json({
      generatedAt: today.toISOString(),
      notSent: true,
      items: candidates,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
