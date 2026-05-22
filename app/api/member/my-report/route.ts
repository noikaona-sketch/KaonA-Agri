import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/member/my-report?member_id=xxx
// รายงานส่วนตัวเกษตรกร: รายได้ น้ำหนัก ต้นทุน เปรียบเทียบเผา/ไม่เผา
export async function GET(request: Request) {
  try {
    const memberId = new URL(request.url).searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ── รอบปลูกทั้งหมดของ member ────────────────────────────────────────
    const { data: cycles, error: cycleErr } = await s
      .from('planting_cycles')
      .select(`
        id, crop_name, season_year, status,
        area_planted_rai, actual_yield_kg, estimated_yield_kg,
        expected_cost_per_rai, expected_cost_per_rai_burn, expected_cost_per_rai_no_burn,
        expected_price_per_kg,
        burn_practice, burn_practice_note,
        started_at, actual_harvest_at
      `)
      .eq('member_id', memberId)
      .order('season_year', { ascending: false })
      .order('started_at', { ascending: false });

    if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 500 });

    // ── ประวัติขายจริง (sale_appointments ที่ completed) ────────────────
    const { data: sales } = await s
      .from('sale_appointments')
      .select('id,planting_cycle_id,actual_qty_kg,estimated_qty_kg,appointment_date,status,pickup_location_name')
      .eq('member_id', memberId)
      .order('appointment_date', { ascending: false });

    // ── no_burn_requests ที่ approved ────────────────────────────────────
    const { data: noBurnApproved } = await s
      .from('no_burn_requests')
      .select('id,planting_cycle_id,status,submitted_at')
      .eq('member_id', memberId)
      .eq('status', 'approved');

    type NoBurnRow = { id: string; planting_cycle_id: string; status: string; submitted_at: string };
    type SaleRow   = { id: string; planting_cycle_id: string | null; actual_qty_kg: number | null; estimated_qty_kg: number | null; appointment_date: string; status: string; pickup_location_name: string | null };

    // ── รวม + คำนวณต่อรอบ ────────────────────────────────────────────────
    const approvedNoBurnCycleIds = new Set((noBurnApproved as NoBurnRow[] ?? []).map((r) => r.planting_cycle_id));

    const cycleReports = (cycles ?? []).map((c) => {
      const cycleSales = (sales as SaleRow[] ?? []).filter((s) => s.planting_cycle_id === c.id);
      const totalQtySold = cycleSales.reduce((sum: number, s: SaleRow) => sum + (s.actual_qty_kg ?? s.estimated_qty_kg ?? 0), 0);
      const noBurnApprovedForCycle = approvedNoBurnCycleIds.has(c.id);

      // ต้นทุน
      const rai             = c.area_planted_rai ?? 0;
      const costPerRai      = noBurnApprovedForCycle
        ? (c.expected_cost_per_rai_no_burn ?? c.expected_cost_per_rai ?? 0)
        : (c.expected_cost_per_rai_burn    ?? c.expected_cost_per_rai ?? 0);
      const totalCost       = rai * costPerRai;

      // รายได้ (ใช้ yield จริงถ้ามี ไม่งั้นใช้ยอดขาย)
      const yieldKg         = c.actual_yield_kg ?? totalQtySold;
      const pricePerKg      = c.expected_price_per_kg ?? 0;
      const estimatedRevenue= yieldKg * pricePerKg;
      const estimatedProfit = estimatedRevenue - totalCost;

      // ประหยัดต้นทุนจากไม่เผา (ถ้าเคยกรอกทั้งคู่)
      const costSavingFromNoBurn = (c.expected_cost_per_rai_burn && c.expected_cost_per_rai_no_burn)
        ? rai * (c.expected_cost_per_rai_burn - c.expected_cost_per_rai_no_burn)
        : null;

      return {
        id:                      c.id,
        crop_name:               c.crop_name,
        season_year:             c.season_year,
        status:                  c.status,
        area_planted_rai:        rai,
        actual_yield_kg:         c.actual_yield_kg,
        estimated_yield_kg:      c.estimated_yield_kg,
        total_qty_sold_kg:       totalQtySold,
        burn_practice:           c.burn_practice,
        no_burn_approved:        noBurnApprovedForCycle,
        cost_per_rai:            costPerRai,
        total_cost:              totalCost,
        expected_price_per_kg:   pricePerKg,
        estimated_revenue:       estimatedRevenue,
        estimated_profit:        estimatedProfit,
        cost_saving_from_no_burn:costSavingFromNoBurn,
        sales:                   cycleSales,
      };
    });

    type CR = typeof cycleReports[0];
    const summary = {
      total_cycles:        cycleReports.length,
      total_area_rai:      cycleReports.reduce((s: number, c: CR) => s + c.area_planted_rai, 0),
      total_yield_kg:      cycleReports.reduce((s: number, c: CR) => s + (c.actual_yield_kg ?? 0), 0),
      total_revenue:       cycleReports.reduce((s: number, c: CR) => s + c.estimated_revenue, 0),
      total_cost:          cycleReports.reduce((s: number, c: CR) => s + c.total_cost, 0),
      total_profit:        cycleReports.reduce((s: number, c: CR) => s + c.estimated_profit, 0),
      no_burn_cycles:      cycleReports.filter((c: CR) => c.no_burn_approved).length,
      total_no_burn_saving:cycleReports.reduce((s: number, c: CR) => s + (c.cost_saving_from_no_burn ?? 0), 0),
    };

    return NextResponse.json({ cycles: cycleReports, summary });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
