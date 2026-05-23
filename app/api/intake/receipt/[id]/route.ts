import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/intake/receipt/[id]
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const s         = createServerSupabaseClient();
    const bookingId = params.id;

    const { data: booking, error } = await s
      .from('harvest_bookings')
      .select(`
        id, member_id, scheduled_date, actual_completed_at,
        intake_source, scale_ticket_no,
        gross_weight_kg, deduct_pct, net_weight_kg,
        actual_moisture_pct, quality_grade,
        price_per_kg, bonus_per_kg, gross_amount, net_amount,
        payment_method,
        pickup_locations!harvest_bookings_intake_location_id_fkey(name),
        members!harvest_bookings_member_id_fkey(full_name, phone, member_no)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });

    const { data: log } = await s
      .from('intake_logs')
      .select('raw_payload')
      .eq('booking_id', bookingId)
      .eq('status', 'success')
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ booking, intake_log: log?.raw_payload ?? null });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
