import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planting_cycle_id: string;
      member_id: string;
      scheduled_date: string;
      scheduled_time_start?: string;
      plot_id?: string;
      truck_note?: string;
    };

    if (!body.planting_cycle_id || !body.member_id || !body.scheduled_date) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    const { data: member, error: memberErr } = await s
      .from('members')
      .select('status')
      .eq('id', body.member_id)
      .maybeSingle();
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
    if (!member || member.status !== 'approved') {
      return NextResponse.json({ error: 'สมาชิกยังไม่ผ่านการอนุมัติ จึงยังนัดรถเกี่ยวไม่ได้' }, { status: 403 });
    }

    // ตรวจว่ามีการนัดอยู่แล้วหรือเปล่า
    const { data: existing } = await s.from('harvest_bookings')
      .select('id').eq('planting_cycle_id', body.planting_cycle_id)
      .in('status', ['pending', 'confirmed']).maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'มีการนัดรถเกี่ยวอยู่แล้ว' }, { status: 409 });
    }

    const { data, error } = await s.from('harvest_bookings').insert({
      planting_cycle_id:    body.planting_cycle_id,
      member_id:            body.member_id,
      scheduled_date:       body.scheduled_date,
      scheduled_time_start: body.scheduled_time_start ?? null,
      plot_id:              body.plot_id ?? null,
      truck_note:           body.truck_note ?? null,
      status: 'pending',
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, booking_id: data.id });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get('cycle_id');
  if (!cycleId) return NextResponse.json({ bookings: [] });

  const s = createServerSupabaseClient();
  const { data } = await s.from('harvest_bookings')
    .select('id,scheduled_date,scheduled_time_start,status,actual_yield_kg,note')
    .eq('planting_cycle_id', cycleId)
    .order('scheduled_date');

  return NextResponse.json({ bookings: data ?? [] });
}
