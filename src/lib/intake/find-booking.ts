// src/lib/intake/find-booking.ts
// ค้นหา harvest_booking ที่ตรงกับ member + location + วันที่
// ถ้าไม่พบ → สร้าง walk-in booking อัตโนมัติ

import type { SupabaseClient } from '@supabase/supabase-js';

type BookingRow = {
  id              : string
  member_id       : string
  scheduled_date  : string
  status          : string
  drying_preference : string | null
};

type FindResult =
  | { found: true;  booking: BookingRow; walk_in: false }
  | { found: true;  booking: BookingRow; walk_in: true  }
  | { found: false; error: string };

// ── ค้นหา member จาก uuid หรือ phone ────────────────────────────────────────
export async function resolveMemberId(
  memberIdOrPhone : string,
  supabase        : SupabaseClient,
): Promise<string | null> {
  // ลอง uuid ก่อน
  if (memberIdOrPhone.includes('-')) {
    const { data } = await supabase
      .from('members').select('id').eq('id', memberIdOrPhone).maybeSingle();
    if (data) return data.id as string;
  }
  // ลองด้วย phone
  const { data } = await supabase
    .from('members').select('id').eq('phone', memberIdOrPhone).maybeSingle();
  return data ? (data.id as string) : null;
}

// ── ค้นหา booking หรือสร้าง walk-in ─────────────────────────────────────────
export async function findOrCreateBooking(
  memberId    : string,
  locationId  : string,
  weighAt     : Date,
  supabase    : SupabaseClient,
): Promise<FindResult> {
  const dateStr = weighAt.toISOString().slice(0, 10);

  // หา booking ที่ confirmed/planned ของวันนั้น
  const { data: existing } = await supabase
    .from('harvest_bookings')
    .select('id,member_id,scheduled_date,status,drying_preference')
    .eq('member_id', memberId)
    .eq('intake_location_id', locationId)
    .eq('scheduled_date', dateStr)
    .in('status', ['planned', 'confirmed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { found: true, booking: existing as BookingRow, walk_in: false };

  // ไม่มี booking → สร้าง walk-in
  const { data: created, error } = await supabase
    .from('harvest_bookings')
    .insert({
      member_id          : memberId,
      intake_location_id : locationId,
      scheduled_date     : dateStr,
      status             : 'planned',
      drying_preference  : 'unknown',
      moisture_source    : 'factory_measure',
    })
    .select('id,member_id,scheduled_date,status,drying_preference')
    .single();

  if (error) return { found: false, error: error.message };
  return { found: true, booking: created as BookingRow, walk_in: true };
}
