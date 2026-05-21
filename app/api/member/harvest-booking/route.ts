import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveCaller }              from './harvest-booking-auth';
import { validateBody, validateEditableFields } from './harvest-booking-validation';
import { validateCycle, checkDuplicate, insertBooking, listBookings, updateBooking, cancelBooking } from './harvest-booking-repository';
import type { HarvestBookingBody } from './harvest-booking-validation';

export async function POST(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as HarvestBookingBody;

    const bodyErr = validateBody(body);
    if (bodyErr) return bodyErr;

    const cycleErr = await validateCycle(s, body.planting_cycle_id, caller.memberId);
    if (cycleErr) return cycleErr;

    const dupErr = await checkDuplicate(s, body.planting_cycle_id);
    if (dupErr) return dupErr;

    const { data, error } = await insertBooking(s, caller.memberId, body);
    if (error || !data) {
      console.error('[HARVEST_BOOKING] insert error:', error);
      return NextResponse.json({ error: error ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking_id: data.id }, { status: 201 });
  } catch (e) {
    console.error('[HARVEST_BOOKING] POST exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const s      = createServerSupabaseClient();
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

    const fieldsErr = validateEditableFields(body);
    if (fieldsErr) return fieldsErr;

    const { data, error } = await updateBooking(s, caller.memberId, { ...body, id: body.id });
    if (error === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบรายการจอง' }, { status: 404 });
    if (error === 'COMPLETED_READ_ONLY' || error === 'CANCELLED_READ_ONLY') {
      return NextResponse.json({ error: 'รายการนี้ไม่สามารถแก้ไขได้' }, { status: 409 });
    }
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, booking: data });
  } catch (e) {
    console.error('[HARVEST_BOOKING] PATCH exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveCaller(request, s);
    if (!caller.ok) return caller.response;

    const cycleId = new URL(request.url).searchParams.get('cycle_id');
    if (!cycleId) return NextResponse.json({ bookings: [] });

    const { data, error } = await listBookings(s, cycleId, caller.memberId);
    if (error) return NextResponse.json({ error }, { status: 500 });

    return NextResponse.json({ bookings: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
