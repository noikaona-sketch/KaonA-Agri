
import { NextResponse } from 'next/server' ; 
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers' ; 
import { resolveCaller } from './harvest-booking-auth' ; 
import { validateBody , validateEditableFields } from './harvest-booking-validation' ; 
import { validateCycle , checkDuplicate , insertBooking , listBookings , updateBooking , cancelBooking } from './harvest-booking-repository' ; 
import type { HarvestBookingBody } from './harvest-booking-validation' ;
import { NextResponse } from 'next/server' ; 
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers' ; 
import { resolveApprovedMember } from '../_auth' ;

type CreateBody = {
  expected_date_from: string;
  expected_date_to: string;
  estimated_tonnage: number;
  estimated_moisture?: number | null;
  requires_dryer: boolean;
  note?: string | null;
};


export async function POST(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;
    const body = (await request.json()) as HarvestBookingBody;
    const bodyErr = validateBody(body); if (bodyErr) return bodyErr;
    const cycleErr = await validateCycle(s, body.planting_cycle_id, caller.memberId); if (cycleErr) return cycleErr;
    const dupErr = await checkDuplicate(s, body.planting_cycle_id); if (dupErr) return dupErr;
    const { data, error } = await insertBooking(s, caller.memberId, body);
    if (error || !data) return NextResponse.json({ error: error ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ ok: true, booking_id: data.id }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;
    const body = (await request.json()) as Partial<HarvestBookingBody> & { id?: string; action?: 'update' | 'cancel' };
    if (!body.id) return NextResponse.json({ error: 'ไม่พบ booking id' }, { status: 400 });
    if (body.action === 'cancel') {
      const { data, error } = await cancelBooking(s, caller.memberId, body.id);
      if (error === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 404 });
      if (error === 'COMPLETED_READ_ONLY') return NextResponse.json({ error: 'รายการที่เสร็จสิ้นแล้วไม่สามารถแก้ไขหรือยกเลิกได้' }, { status: 409 });
      if (error) return NextResponse.json({ error }, { status: 500 });
      return NextResponse.json({ ok: true, booking: data });
    }
    const fieldsErr = validateEditableFields(body); if (fieldsErr) return fieldsErr;
    const { data, error } = await updateBooking(s, caller.memberId, { ...body, id: body.id });
    if (error === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 404 });
    if (error === 'COMPLETED_READ_ONLY' || error === 'CANCELLED_READ_ONLY') return NextResponse.json({ error: 'รายการนี้ไม่สามารถแก้ไขได้' }, { status: 409 });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, booking: data });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;
    const cycleId = new URL(request.url).searchParams.get('cycle_id');
    if (!cycleId) return NextResponse.json({ bookings: [] });
    const { data, error } = await listBookings(s, cycleId, caller.memberId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ bookings: data });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

    const auth = await resolveApprovedMember(request, s);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as CreateBody;
    if (!body.expected_date_from || !body.expected_date_to) {
      return NextResponse.json({ error: 'expected_date_from และ expected_date_to จำเป็น' }, { status: 400 });
    }
    if (!Number.isFinite(body.estimated_tonnage) || body.estimated_tonnage <= 0) {
      return NextResponse.json({ error: 'estimated_tonnage ต้องมากกว่า 0' }, { status: 400 });
    }

    const { data: cycle } = await s
      .from('planting_cycles')
      .select('id')
      .eq('member_id', auth.memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cycle?.id) {
      return NextResponse.json({ error: 'ไม่พบรอบปลูกสำหรับการจองเก็บเกี่ยว' }, { status: 409 });
    }

    const { data, error } = await s.from('harvest_bookings').insert({
      member_id: auth.memberId,
      planting_cycle_id: cycle.id,
      scheduled_date: body.expected_date_from,
      expected_date_from: body.expected_date_from,
      expected_date_to: body.expected_date_to,
      estimated_tonnage: body.estimated_tonnage,
      estimated_moisture: body.estimated_moisture ?? null,
      requires_dryer: body.requires_dryer,
      note: body.note ?? null,
      status: 'planned',
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, booking_id: data.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const auth = await resolveApprovedMember(request, s);
  if (!auth.ok) return auth.response;

  const { data, error } = await s
    .from('harvest_bookings')
    .select('id, expected_date_from, expected_date_to, estimated_tonnage, estimated_moisture, requires_dryer, note, status, created_at')
    .eq('member_id', auth.memberId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });

}
