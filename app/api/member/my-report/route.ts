import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

type StdCfg = {
  crop_type: string; yield_per_rai: number;
  standard_cost_per_rai_burn: number | null;
  standard_cost_per_rai_no_burn: number | null;
  standard_price_per_kg: number | null;
};
type NoBurnRow = { planting_cycle_id: string };
type SaleRow   = {
  planting_cycle_id: string | null; actual_qty_kg: number | null;
  estimated_qty_kg: number | null; appointment_date: string;
  pickup_location_name: string | null;
};

export async function GET(request: Request) {
  try {
    const memberId = new URL(request.url).searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

    const s = createServerSupabaseClient();

    const [cycleRes, salesRes, noBurnRes, stdRes] = await Promise.all([
      s.from('planting_cycles').select(`
        id, crop_name, season_year, status,
        area_planted_rai, actual_yield_kg, estimated_yield_kg,
        expected_cost_per_rai, expected_cost_per_rai_burn, expected_cost_per_rai_no_burn,
        expected_price_per_kg, burn_practice, started_at, actual_harvest_at
      `).eq('member_id', memberId).order('season_year', { ascending: false }),

      s.from('sale_appointments').select(
        'planting_cycle_id,actual_qty_kg,estimated_qty_kg,appointment_date,pickup_location_name'
      ).eq('member_id', memberId).order('appointment_date', { ascending: false }),

      s.from('no_burn_requests').select('planting_cycle_id')
        .eq('member_id', memberId).eq('status', 'approved'),

      s.from('crop_yield_config').select(
        'crop_type,yield_per_rai,standard_cost_per_rai_burn,standard_cost_per_rai_no_burn,standard_price_per_kg'
      ),
    ]);

    if (cycleRes.error) return NextResponse.json({ error: cycleRes.error.message }, { status: 500 });

    const stdMap: Record<string, StdCfg> = {};
    (stdRes.data as StdCfg[] ?? []).forEach((c) => { stdMap[c.crop_type] = c; });

    const approvedCycleIds = new Set((noBurnRes.data as NoBurnRow[] ?? []).map((r) => r.planting_cycle_id));
    const sales            = salesRes.data as SaleRow[] ?? [];

    const cycleReports = (cycleRes.data ?? []).map((c) => {
      const cycleSales   = sales.filter((s) => s.planting_cycle_id === c.id);
      const totalSoldKg  = cycleSales.reduce((sum: number, s: SaleRow) =>
        sum + (s.actual_qty_kg ?? s.estimated_qty_kg ?? 0), 0);

      const std          = stdMap[c.crop_name] ?? stdMap['ข้าวโพด'] ?? null;
      const isNoBurn     = approvedCycleIds.has(c.id) || c.burn_practice === 'no_burn';
      const rai          = c.area_planted_rai ?? 0;

      // fallback: member → standard (admin ตั้ง)
      const costPerRai   = isNoBurn
        ? (c.expected_cost_per_rai_no_burn ?? c.expected_cost_per_rai ?? std?.standard_cost_per_rai_no_burn ?? 0)
        : (c.expected_cost_per_rai_burn    ?? c.expected_cost_per_rai ?? std?.standard_cost_per_rai_burn    ?? 0);
      const pricePerKg   = c.expected_price_per_kg ?? std?.standard_price_per_kg ?? 0;
      const fallbackYield= std?.yield_per_rai ?? 1200;

      const costSource   = (c.expected_cost_per_rai_no_burn ?? c.expected_cost_per_rai_burn ?? c.expected_cost_per_rai) ? 'member' : 'standard';
      const priceSource  = c.expected_price_per_kg ? 'member' : 'standard';

      const yieldKg      = c.actual_yield_kg ?? (totalSoldKg > 0 ? totalSoldKg : rai * fallbackYield);
      const totalCost    = rai * costPerRai;
      const revenue      = yieldKg * pricePerKg;
      const profit       = revenue - totalCost;

      const stdBurn      = c.expected_cost_per_rai_burn    ?? std?.standard_cost_per_rai_burn;
      const stdNoBurn    = c.expected_cost_per_rai_no_burn ?? std?.standard_cost_per_rai_no_burn;
      const noBurnSaving = (stdBurn && stdNoBurn) ? rai * (stdBurn - stdNoBurn) : null;

      return {
        id: c.id, crop_name: c.crop_name, season_year: c.season_year, status: c.status,
        area_planted_rai: rai, actual_yield_kg: c.actual_yield_kg,
        total_qty_sold_kg: totalSoldKg, burn_practice: c.burn_practice,
        no_burn_approved: approvedCycleIds.has(c.id),
        cost_per_rai: costPerRai, cost_source: costSource,
        price_per_kg: pricePerKg, price_source: priceSource,
        total_cost: totalCost, estimated_revenue: revenue, estimated_profit: profit,
        cost_saving_from_no_burn: noBurnSaving,
        sales: cycleSales.map((s) => ({
          appointment_date: s.appointment_date,
          actual_qty_kg: s.actual_qty_kg,
          pickup_location_name: s.pickup_location_name,
        })),
      };
    });

    type CR = typeof cycleReports[0];
    const summary = {
      total_cycles:         cycleReports.length,
      total_area_rai:       cycleReports.reduce((s: number, c: CR) => s + c.area_planted_rai, 0),
      total_yield_kg:       cycleReports.reduce((s: number, c: CR) => s + (c.actual_yield_kg ?? 0), 0),
      total_revenue:        cycleReports.reduce((s: number, c: CR) => s + c.estimated_revenue, 0),
      total_cost:           cycleReports.reduce((s: number, c: CR) => s + c.total_cost, 0),
      total_profit:         cycleReports.reduce((s: number, c: CR) => s + c.estimated_profit, 0),
      no_burn_cycles:       cycleReports.filter((c: CR) => c.no_burn_approved).length,
      total_no_burn_saving: cycleReports.reduce((s: number, c: CR) => s + (c.cost_saving_from_no_burn ?? 0), 0),
    };

    return NextResponse.json({ cycles: cycleReports, summary });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
