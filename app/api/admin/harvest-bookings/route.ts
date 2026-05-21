import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../members/_admin-auth';

export async function GET() {
  const auth = await requireAdminPermission('harvest.read');
  if (isForbidden(auth)) return auth.forbidden;

  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('harvest_bookings')
    .select('id, member_id, expected_date_from, expected_date_to, estimated_tonnage, estimated_moisture, requires_dryer, note, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}
