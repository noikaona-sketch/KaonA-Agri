import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sale_appointment_id?: string;
      harvest_booking_id?: string;
      quality_moisture: number;
      quality_grade: string;
      quality_note?: string;
      actual_qty_kg?: number;
      reviewed_by?: string;
    };
    const s = createServerSupabaseClient();

    if (body.sale_appointment_id) {
      const { error } = await s.from('sale_appointments').update({
        quality_moisture:    body.quality_moisture,
        quality_grade:       body.quality_grade,
        quality_note:        body.quality_note ?? null,
        quality_recorded_at: new Date().toISOString(),
        quality_recorded_by: body.reviewed_by ?? null,
        ...(body.actual_qty_kg ? { actual_qty_kg: body.actual_qty_kg, status: 'completed' } : {}),
      }).eq('id', body.sale_appointment_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.harvest_booking_id) {
      const { error } = await s.from('harvest_bookings').update({
        quality_moisture: body.quality_moisture,
        quality_grade:    body.quality_grade,
        quality_note:     body.quality_note ?? null,
        ...(body.actual_qty_kg ? { actual_yield_kg: body.actual_qty_kg, status: 'completed', truck_status: 'done' } : {}),
      }).eq('id', body.harvest_booking_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
