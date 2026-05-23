import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../admin/members/_admin-auth';
import { resolveMemberId, findOrCreateBooking } from '@/lib/intake/find-booking';
import { calculateIntake }            from '@/lib/intake/calculate-intake';
import { sendIntakeReceipt }          from '@/lib/intake/send-intake-receipt';

export const dynamic = 'force-dynamic';

type ManualBody = {
  // ค้นหา booking
  booking_id?      : string
  member_phone?    : string   // สำหรับ walk-in ที่ไม่ได้จอง
  member_id?       : string
  location_id      : string
  // ข้อมูลชั่ง
  gross_weight_kg  : number
  moisture_pct     : number
  quality_grade?   : 'A' | 'B' | 'C' | 'reject'
  scale_ticket_no? : string
  weigh_at?        : string   // default = now()
  intake_note?     : string
  crop_type?       : string
  // การชำระ
  payment_method?  : 'transfer' | 'cash' | 'credit' | 'debit_account'
  payment_ref?     : string
};

export async function POST(request: Request) {
  const s = createServerSupabaseClient();

  try {
    // 1. Auth — staff, admin เท่านั้น
    const _ar = await requireAdminPermission('service.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const staffId = _ar.admin.adminUserId;

    const body = (await request.json()) as ManualBody;
    if (!body.location_id || !body.gross_weight_kg || !body.moisture_pct)
      return NextResponse.json({ error: 'location_id, gross_weight_kg, moisture_pct required' }, { status: 400 });

    const weighAt = body.weigh_at ? new Date(body.weigh_at) : new Date();

    // 2. Resolve member
    let memberId = body.member_id;
    if (!memberId && body.member_phone) {
      memberId = (await resolveMemberId(body.member_phone, s)) ?? undefined;
      if (!memberId)
        return NextResponse.json({ error: `ไม่พบสมาชิก phone: ${body.member_phone}` }, { status: 404 });
    }
    if (!memberId)
      return NextResponse.json({ error: 'ต้องระบุ member_id หรือ member_phone' }, { status: 400 });

    // 3. Preview mode — คำนวณก่อนบันทึก (ไม่มี side effects)
    const url    = new URL(request.url);
    if (url.searchParams.get('preview') === '1') {
      const preview = await calculateIntake({ gross_weight_kg:body.gross_weight_kg, moisture_pct:body.moisture_pct, member_id:memberId, location_id:body.location_id, weigh_at:weighAt, crop_type:body.crop_type }, s);
      return NextResponse.json({ ok:true, preview, member_id:memberId });
    }

    // 4. Reject — ไม่คำนวณ
    if (body.quality_grade === 'reject') {
      const res = await findOrCreateBooking(memberId, body.location_id, weighAt, s);
      if (!res.found) return NextResponse.json({ error: res.error }, { status: 500 });
      await s.from('harvest_bookings').update({
        status:'rejected', quality_grade:'reject',
        gross_weight_kg:body.gross_weight_kg,
        actual_moisture_pct:body.moisture_pct,
        scale_ticket_no:body.scale_ticket_no,
        rejection_reason:body.intake_note,
        intake_source:'manual', intake_by:staffId,
        intake_location_id:body.location_id,
      }).eq('id', res.booking.id);
      return NextResponse.json({ ok:true, rejected:true, booking_id:res.booking.id });
    }

    // 5. Find หรือ create booking
    const bookRes = body.booking_id
      ? { found:true as const, booking:{ id:body.booking_id, member_id:memberId, scheduled_date:weighAt.toISOString().slice(0,10), status:'planned', drying_preference:null }, walk_in:false as const }
      : await findOrCreateBooking(memberId, body.location_id, weighAt, s);
    if (!bookRes.found) return NextResponse.json({ error: bookRes.error }, { status: 500 });

    // 6. Calculate
    const result = await calculateIntake({ gross_weight_kg:body.gross_weight_kg, moisture_pct:body.moisture_pct, member_id:memberId, location_id:body.location_id, weigh_at:weighAt, crop_type:body.crop_type }, s);

    // 7. บันทึก
    await s.from('harvest_bookings').update({
      status:'completed', actual_completed_at:new Date().toISOString(),
      intake_source:'manual', intake_by:staffId,
      intake_location_id:body.location_id,
      scale_ticket_no:body.scale_ticket_no,
      quality_grade:body.quality_grade ?? 'B',
      gross_weight_kg:result.gross_weight_kg,
      deduct_pct:result.deduct_pct,
      net_weight_kg:result.net_weight_kg,
      actual_received_kg:result.net_weight_kg,
      actual_moisture_pct:body.moisture_pct,
      price_per_kg:result.final_price,
      bonus_per_kg:result.total_bonus,
      gross_amount:result.gross_amount,
      net_amount:result.net_amount,
      payment_method:body.payment_method,
      payment_ref:body.payment_ref,
    }).eq('id', bookRes.booking.id);

    await s.from('intake_logs').insert({ booking_id:bookRes.booking.id, source:'manual', raw_payload:body as unknown as Record<string,unknown>, processed_by:staffId, status:'success' });

    // 8. LINE push (async)
    const { data: member } = await s.from('members').select('line_uid').eq('id', memberId).maybeSingle();
    if (member?.line_uid) {
      void sendIntakeReceipt({ lineUid:member.line_uid as string, result, bookingId:bookRes.booking.id, scaleTicketNo:body.scale_ticket_no });
    }

    return NextResponse.json({ ok:true, booking_id:bookRes.booking.id, walk_in:bookRes.walk_in, result: { net_weight_kg:result.net_weight_kg, net_amount:result.net_amount, final_price:result.final_price, applied_promos:result.applied_promos.filter(p=>p.applied) } });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
