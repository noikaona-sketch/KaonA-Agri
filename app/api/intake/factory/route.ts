import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { verifyFactoryKey }           from '@/lib/intake/verify-factory-key';
import { resolveMemberId, findOrCreateBooking } from '@/lib/intake/find-booking';
import { calculateIntake }            from '@/lib/intake/calculate-intake';
import { sendIntakeReceipt }          from '@/lib/intake/send-intake-receipt';

export const dynamic = 'force-dynamic';

type FactoryBody = {
  scale_ticket_no : string
  member_id       : string       // uuid หรือ phone
  weigh_at        : string       // ISO datetime
  gross_weight_kg : number
  moisture_pct    : number
  quality_grade?  : 'A' | 'B' | 'C' | 'reject'
  crop_type?      : string
};

export async function POST(request: Request) {
  const s = createServerSupabaseClient();
  let locationId = '';

  try {
    // 1. Verify API key → get location
    const keyResult = await verifyFactoryKey(request.headers.get('Authorization'), s);
    locationId = keyResult.location_id;

    const body = (await request.json()) as FactoryBody;
    if (!body.scale_ticket_no || !body.member_id || !body.gross_weight_kg || !body.moisture_pct)
      return NextResponse.json({ error: 'scale_ticket_no, member_id, gross_weight_kg, moisture_pct required' }, { status: 400 });

    // 2. Idempotency — reject duplicate scale_ticket_no
    const { data: dup } = await s
      .from('harvest_bookings')
      .select('id,net_amount,net_weight_kg')
      .eq('intake_location_id', locationId)
      .eq('scale_ticket_no', body.scale_ticket_no)
      .maybeSingle();
    if (dup) return NextResponse.json({ ok: true, duplicate: true, booking_id: dup.id, net_amount: dup.net_amount, net_weight_kg: dup.net_weight_kg });

    // 3. Resolve member
    const memberId = await resolveMemberId(body.member_id, s);
    if (!memberId) return NextResponse.json({ error: `member not found: ${body.member_id}` }, { status: 404 });

    // 4. Handle reject — no calculation needed
    if (body.quality_grade === 'reject') {
      const weighAt = new Date(body.weigh_at);
      const res = await findOrCreateBooking(memberId, locationId, weighAt, s);
      if (!res.found) return NextResponse.json({ error: res.error }, { status: 500 });
      await s.from('harvest_bookings').update({ status:'rejected', quality_grade:'reject', gross_weight_kg:body.gross_weight_kg, actual_moisture_pct:body.moisture_pct, scale_ticket_no:body.scale_ticket_no, intake_source:'factory_api', intake_location_id:locationId }).eq('id', res.booking.id);
      await s.from('intake_logs').insert({ booking_id:res.booking.id, source:'factory_api', raw_payload:body as unknown as Record<string,unknown>, status:'success' });
      return NextResponse.json({ ok:true, rejected:true, booking_id:res.booking.id });
    }

    // 5. Find or create booking
    const weighAt = new Date(body.weigh_at);
    const bookRes = await findOrCreateBooking(memberId, locationId, weighAt, s);
    if (!bookRes.found) return NextResponse.json({ error: bookRes.error }, { status: 500 });
    const booking = bookRes.booking;

    // 6. Calculate
    const result = await calculateIntake({ gross_weight_kg:body.gross_weight_kg, moisture_pct:body.moisture_pct, member_id:memberId, location_id:locationId, weigh_at:weighAt, crop_type:body.crop_type }, s);

    // 7. Save actual data
    await s.from('harvest_bookings').update({
      status:              'completed',
      actual_completed_at: new Date().toISOString(),
      intake_source:       'factory_api',
      intake_source_ref:   body.scale_ticket_no,
      intake_location_id:  locationId,
      scale_ticket_no:     body.scale_ticket_no,
      quality_grade:       body.quality_grade ?? 'B',
      gross_weight_kg:     result.gross_weight_kg,
      deduct_pct:          result.deduct_pct,
      net_weight_kg:       result.net_weight_kg,
      actual_received_kg:  result.net_weight_kg,
      actual_moisture_pct: body.moisture_pct,
      price_per_kg:        result.final_price,
      bonus_per_kg:        result.total_bonus,
      gross_amount:        result.gross_amount,
      net_amount:          result.net_amount,
    }).eq('id', booking.id);

    // 8. Audit log
    await s.from('intake_logs').insert({ booking_id:booking.id, source:'factory_api', raw_payload:body as unknown as Record<string,unknown>, status:'success' });

    // 9. LINE push (async, fail silently)
    const { data: member } = await s.from('members').select('line_uid').eq('id', memberId).maybeSingle();
    if (member?.line_uid) {
      void sendIntakeReceipt({ lineUid:member.line_uid as string, result, bookingId:booking.id, scaleTicketNo:body.scale_ticket_no });
    }

    return NextResponse.json({ ok:true, booking_id:booking.id, walk_in:bookRes.walk_in, net_weight_kg:result.net_weight_kg, net_amount:result.net_amount, applied_promos:result.applied_promos.filter(p=>p.applied) });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Invalid API key') || msg.includes('Authorization')) return NextResponse.json({ error:msg }, { status:401 });
    void s.from('intake_logs').insert({ source:'factory_api', status:'error', error_message:msg });
    return NextResponse.json({ error:msg }, { status:500 });
  }
}
