import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';


export async function GET() {
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
