import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/member/harvest-booking/dryer-status?date=YYYY-MM-DD&location_id=xxx
// farmer ดูสถานะคิวอบ + โควต้าที่เหลือ ก่อนตัดสินใจจองวันเกี่ยว
export async function GET(request: Request) {
  try {
    const url        = new URL(request.url);
    const dateParam  = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const locationId = url.searchParams.get('location_id');
    const s          = createServerSupabaseClient();

    // ── โควต้าจาก pickup_slots ─────────────────────────────────────────
    let slotQ = s.from('pickup_slots')
      .select('id,pickup_date,capacity_kg_dryer,capacity_kg_dry,booked_kg_dryer,booked_kg_dry,status,pickup_locations(id,name,accepts_wet,dryer_capacity_kg)')
      .gte('pickup_date', dateParam)
      .lte('pickup_date', new Date(new Date(dateParam).getTime() + 7 * 86400_000).toISOString().slice(0, 10))
      .eq('status', 'open')
      .order('pickup_date');
    if (locationId) slotQ = slotQ.eq('location_id', locationId);
    const { data: slots } = await slotQ;

    // ── harvest_bookings ที่ต้องการอบในช่วงนั้น (ใช้คาดปริมาณ) ──────────
    const { data: bookings } = await s
      .from('harvest_bookings')
      .select('scheduled_date,estimated_moisture,estimated_tonnage,drying_preference')
      .gte('scheduled_date', dateParam)
      .lte('scheduled_date', new Date(new Date(dateParam).getTime() + 7 * 86400_000).toISOString().slice(0, 10))
      .in('status', ['planned', 'pending', 'confirmed'])
      .eq('drying_preference', 'required');

    // รวมปริมาณต่อวัน
    type DayLoad = { booking_kg: number; slot: typeof slots extends (infer T)[] ? T : never | null };
    const dayMap: Record<string, { booking_kg: number; slot: NonNullable<typeof slots>[0] | null }> = {};

    (bookings ?? []).forEach((b) => {
      const d = b.scheduled_date;
      if (!dayMap[d]) dayMap[d] = { booking_kg: 0, slot: null };
      dayMap[d].booking_kg += (b.estimated_tonnage ?? 0) * 1000;
    });
    (slots ?? []).forEach((s) => {
      if (!dayMap[s.pickup_date]) dayMap[s.pickup_date] = { booking_kg: 0, slot: null };
      dayMap[s.pickup_date].slot = s;
    });

    const days = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { booking_kg, slot }]) => {
        const cap         = slot?.capacity_kg_dryer ?? null;
        const booked      = slot?.booked_kg_dryer ?? booking_kg;
        const remaining   = cap != null ? Math.max(0, cap - booked) : null;
        const utilPct     = cap ? Math.round((booked / cap) * 100) : null;
        const level       = utilPct == null ? 'unknown'
          : utilPct >= 90 ? 'full'
          : utilPct >= 60 ? 'busy'
          : 'available';
        return { date, booked_kg: booked, capacity_kg: cap, remaining_kg: remaining, util_pct: utilPct, level, has_slot: !!slot };
      });

    return NextResponse.json({ days, as_of: dateParam });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
