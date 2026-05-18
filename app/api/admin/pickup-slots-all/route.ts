import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('service.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await s
    .from('pickup_slots')
    .select('id,pickup_date,pickup_time,capacity_qty,booked_qty,status,note,pickup_locations(id,name,address,map_url)')
    .in('status', ['open','closed','full'])
    .gte('pickup_date', today)
    .order('pickup_date')
    .limit(30);
  return NextResponse.json({ slots: data ?? [] });
}
