import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { HARVESTABLE_STATUSES }       from './harvest-booking-validation';
import type { HarvestBookingBody }    from './harvest-booking-validation';

type UpdateBookingBody = Partial<HarvestBookingBody> & { id: string };

type Supabase = ReturnType<typeof createServerSupabaseClient>;

// Verify cycle exists, belongs to caller, and is in a harvestable status.
export async function validateCycle(
  s: Supabase,
  cycleId: string,
  memberId: string,
): Promise<ReturnType<typeof NextResponse.json> | null> {
  const { data: cycle } = await s
    .from('planting_cycles')
    .select('id, member_id, status')
    .eq('id', cycleId)
    .maybeSingle();

  if (!cycle) {
    return NextResponse.json({ error: 'ไม่พบรอบปลูก' }, { status: 404 });
  }
  if (cycle.member_id !== memberId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้รอบปลูกนี้' }, { status: 403 });
  }
  if (!(HARVESTABLE_STATUSES as readonly string[]).includes(cycle.status ?? '')) {
    return NextResponse.json(
      { error: `รอบปลูกสถานะ "${cycle.status}" ยังไม่พร้อมแจ้งเก็บเกี่ยว` },
      { status: 409 },
    );
  }
  return null;
}

// Check for existing pending/confirmed booking on the same cycle.
export async function checkDuplicate(
  s: Supabase,
  cycleId: string,
): Promise<ReturnType<typeof NextResponse.json> | null> {
  const { data: existing } = await s
    .from('harvest_bookings')
    .select('id')
    .eq('planting_cycle_id', cycleId)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'มีการแจ้งเก็บเกี่ยวรอดำเนินการอยู่แล้ว' }, { status: 409 });
  }
  return null;
}

// Insert harvest booking row.
export async function insertBooking(
  s: Supabase,
  memberId: string,
  body: HarvestBookingBody,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const { data, error } = await s
    .from('harvest_bookings')
    .insert({
      planting_cycle_id:      body.planting_cycle_id,
      member_id:              memberId,
      scheduled_date:         body.scheduled_date,
      plot_id:                body.plot_id               ?? null,
      note:                   body.note                  ?? null,
      drying_preference:      body.drying_preference     ?? 'unknown',
      delivery_type:          body.delivery_type          ?? 'unknown',
      estimated_moisture_pct: body.estimated_moisture_pct ?? null,
      moisture_source:        body.moisture_source        ?? null,
      actual_yield_kg:        body.estimated_yield_kg     ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  return { data: data as { id: string } | null, error: error?.message ?? null };
}

// List bookings for a cycle, scoped to caller.
export async function listBookings(
  s: Supabase,
  cycleId: string,
  memberId: string,
) {
  const { data, error } = await s
    .from('harvest_bookings')
    .select(
      'id, scheduled_date, status, actual_yield_kg, note,' +
      'drying_preference, delivery_type, estimated_moisture_pct, moisture_source',
    )
    .eq('planting_cycle_id', cycleId)
    .eq('member_id', memberId)
    .order('scheduled_date', { ascending: false });

  return { data: data ?? [], error: error?.message ?? null };
}


// Update a member-owned booking if it is still editable.
export async function updateBooking(
  s: Supabase,
  memberId: string,
  body: UpdateBookingBody,
): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const { data: current, error: loadErr } = await s
    .from('harvest_bookings')
    .select('id,status,member_id')
    .eq('id', body.id)
    .maybeSingle();

  if (loadErr) return { data: null, error: loadErr.message };
  if (!current || current.member_id !== memberId) return { data: null, error: 'NOT_FOUND' };
  if (current.status === 'completed') return { data: null, error: 'COMPLETED_READ_ONLY' };
  if (current.status === 'cancelled') return { data: null, error: 'CANCELLED_READ_ONLY' };

  const patch: Record<string, unknown> = {};
  if (body.scheduled_date !== undefined) patch.scheduled_date = body.scheduled_date;
  if (body.note !== undefined) patch.note = body.note ?? null;
  if (body.drying_preference !== undefined) patch.drying_preference = body.drying_preference;
  if (body.delivery_type !== undefined) patch.delivery_type = body.delivery_type;
  if (body.estimated_moisture_pct !== undefined) patch.estimated_moisture_pct = body.estimated_moisture_pct ?? null;
  if (body.moisture_source !== undefined) patch.moisture_source = body.moisture_source ?? null;
  if (body.estimated_yield_kg !== undefined) patch.actual_yield_kg = body.estimated_yield_kg ?? null;

  const { data, error } = await s
    .from('harvest_bookings')
    .update(patch)
    .eq('id', body.id)
    .eq('member_id', memberId)
    .select('id,status')
    .single();

  return { data: data as { id: string; status: string } | null, error: error?.message ?? null };
}

// Soft cancel only: update status to cancelled (no delete).
export async function cancelBooking(
  s: Supabase,
  memberId: string,
  bookingId: string,
): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const { data: current, error: loadErr } = await s
    .from('harvest_bookings')
    .select('id,status,member_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (loadErr) return { data: null, error: loadErr.message };
  if (!current || current.member_id !== memberId) return { data: null, error: 'NOT_FOUND' };
  if (current.status === 'completed') return { data: null, error: 'COMPLETED_READ_ONLY' };
  if (current.status === 'cancelled') return { data: current as { id: string; status: string }, error: null };

  const { data, error } = await s
    .from('harvest_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('member_id', memberId)
    .select('id,status')
    .single();

  return { data: data as { id: string; status: string } | null, error: error?.message ?? null };
}
