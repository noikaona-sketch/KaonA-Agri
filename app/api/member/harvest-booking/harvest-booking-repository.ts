import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { HARVESTABLE_STATUSES }       from './harvest-booking-validation';
import type { HarvestBookingBody }    from './harvest-booking-validation';

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
