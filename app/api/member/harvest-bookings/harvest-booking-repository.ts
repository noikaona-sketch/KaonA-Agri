import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { HARVESTABLE_STATUSES }       from './harvest-booking-validation';
import type { HarvestBookingBody }    from './harvest-booking-validation';

type UpdateBookingBody = Partial<HarvestBookingBody> & { id: string };
type Supabase = ReturnType<typeof createServerSupabaseClient>;

export async function validateCycle(s: Supabase, cycleId: string, memberId: string): Promise<ReturnType<typeof NextResponse.json> | null> {
  const { data: cycle } = await s.from('planting_cycles').select('id, member_id, status').eq('id', cycleId).maybeSingle();
  if (!cycle) return NextResponse.json({ error: 'ไม่พบรอบปลูก' }, { status: 404 });
  if (cycle.member_id !== memberId) return NextResponse.json({ error: 'ไม่มีสิทธิ์ใช้รอบปลูกนี้' }, { status: 403 });
  if (!(HARVESTABLE_STATUSES as readonly string[]).includes(cycle.status ?? '')) {
    return NextResponse.json({ error: `รอบปลูกสถานะ "${cycle.status}" ยังไม่พร้อมแจ้งเก็บเกี่ยว` }, { status: 409 });
  }
  return null;
}

export async function checkDuplicate(s: Supabase, cycleId: string): Promise<ReturnType<typeof NextResponse.json> | null> {
  const { data: existing } = await s.from('harvest_bookings').select('id').eq('planting_cycle_id', cycleId).in('status', ['planned', 'pending', 'confirmed']).maybeSingle();
  if (existing) return NextResponse.json({ error: 'มีการแจ้งเก็บเกี่ยวรอดำเนินการอยู่แล้ว' }, { status: 409 });
  return null;
}

export async function insertBooking(s: Supabase, memberId: string, body: HarvestBookingBody): Promise<{ data: { id: string } | null; error: string | null }> {
  const { data, error } = await s.from('harvest_bookings').insert({
    planting_cycle_id: body.planting_cycle_id,
    member_id: memberId,
    expected_date_from: body.expected_date_from,
    expected_date_to: body.expected_date_to,
    estimated_tonnage: body.estimated_tonnage ?? null,
    estimated_moisture: body.estimated_moisture ?? null,
    requires_dryer: body.requires_dryer ?? false,
    note: body.note ?? null,
    status: 'pending',
  }).select('id').single();
  return { data: data as { id: string } | null, error: error?.message ?? null };
}

export async function listBookings(s: Supabase, cycleId: string, memberId: string) {
  const { data, error } = await s.from('harvest_bookings').select('id,status,expected_date_from,expected_date_to,estimated_tonnage,estimated_moisture,requires_dryer,note,scheduled_date').eq('planting_cycle_id', cycleId).eq('member_id', memberId).order('created_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function updateBooking(s: Supabase, memberId: string, body: UpdateBookingBody): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const { data: current, error: loadErr } = await s.from('harvest_bookings').select('id,status,member_id').eq('id', body.id).maybeSingle();
  if (loadErr) return { data: null, error: loadErr.message };
  if (!current || current.member_id !== memberId) return { data: null, error: 'NOT_FOUND' };
  if (current.status === 'completed') return { data: null, error: 'COMPLETED_READ_ONLY' };
  if (current.status === 'cancelled') return { data: null, error: 'CANCELLED_READ_ONLY' };

  const patch: Record<string, unknown> = {};
  if (body.expected_date_from !== undefined) patch.expected_date_from = body.expected_date_from;
  if (body.expected_date_to !== undefined) patch.expected_date_to = body.expected_date_to;
  if (body.estimated_tonnage !== undefined) patch.estimated_tonnage = body.estimated_tonnage ?? null;
  if (body.estimated_moisture !== undefined) patch.estimated_moisture = body.estimated_moisture ?? null;
  if (body.requires_dryer !== undefined) patch.requires_dryer = body.requires_dryer;
  if (body.note !== undefined) patch.note = body.note ?? null;

  const { data, error } = await s.from('harvest_bookings').update(patch).eq('id', body.id).eq('member_id', memberId).select('id,status').single();
  return { data: data as { id: string; status: string } | null, error: error?.message ?? null };
}

export async function cancelBooking(s: Supabase, memberId: string, bookingId: string): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const { data: current, error: loadErr } = await s.from('harvest_bookings').select('id,status,member_id').eq('id', bookingId).maybeSingle();
  if (loadErr) return { data: null, error: loadErr.message };
  if (!current || current.member_id !== memberId) return { data: null, error: 'NOT_FOUND' };
  if (current.status === 'completed') return { data: null, error: 'COMPLETED_READ_ONLY' };
  if (current.status === 'cancelled') return { data: current as { id: string; status: string }, error: null };
  const { data, error } = await s.from('harvest_bookings').update({ status: 'cancelled' }).eq('id', bookingId).eq('member_id', memberId).select('id,status').single();
  return { data: data as { id: string; status: string } | null, error: error?.message ?? null };
}
