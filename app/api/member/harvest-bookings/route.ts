import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember } from '../_auth';

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

type PatchBody = {
  id: string;
  status?: 'cancelled';
  expected_date_from?: string;
  expected_date_to?: string;
  estimated_tonnage?: number;
  estimated_moisture?: number | null;
  requires_dryer?: boolean;
  note?: string | null;
};

export async function PATCH(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const auth = await resolveApprovedMember(request, s);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as PatchBody;
    if (!body.id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });

    const { data: booking, error: findError } = await s
      .from('harvest_bookings')
      .select('id, member_id, status')
      .eq('id', body.id)
      .eq('member_id', auth.memberId)
      .maybeSingle();

    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
    if (!booking) return NextResponse.json({ error: 'ไม่พบรายการจองของสมาชิก' }, { status: 404 });

    if (body.status === 'cancelled') {
      if (booking.status === 'completed') {
        return NextResponse.json({ error: 'ไม่สามารถแก้ไขหรือยกเลิกรายการที่เสร็จสิ้นแล้ว' }, { status: 409 });
      }
      if (booking.status === 'cancelled') {
        return NextResponse.json({ ok: true });
      }

      const { error } = await s
        .from('harvest_bookings')
        .update({ status: 'cancelled' })
        .eq('id', body.id)
        .eq('member_id', auth.memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return NextResponse.json({ error: 'ไม่สามารถแก้ไขรายการที่เสร็จสิ้นหรือยกเลิกแล้ว' }, { status: 409 });
    }

    const update: Record<string, unknown> = {};
    if (body.expected_date_from !== undefined) update.expected_date_from = body.expected_date_from;
    if (body.expected_date_to !== undefined) update.expected_date_to = body.expected_date_to;
    if (body.estimated_tonnage !== undefined) {
      if (!Number.isFinite(body.estimated_tonnage) || body.estimated_tonnage <= 0) {
        return NextResponse.json({ error: 'estimated_tonnage ต้องมากกว่า 0' }, { status: 400 });
      }
      update.estimated_tonnage = body.estimated_tonnage;
    }
    if (body.estimated_moisture !== undefined) update.estimated_moisture = body.estimated_moisture;
    if (body.requires_dryer !== undefined) update.requires_dryer = body.requires_dryer;
    if (body.note !== undefined) update.note = body.note;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลสำหรับแก้ไข' }, { status: 400 });
    }

    const { error } = await s
      .from('harvest_bookings')
      .update(update)
      .eq('id', body.id)
      .eq('member_id', auth.memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
