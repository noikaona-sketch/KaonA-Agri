import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s
    .from('crop_yield_config')
    .select('crop_type, yield_per_rai, quota_per_seed_kg, seed_to_yield_ratio')
    .order('crop_type');
  return NextResponse.json({ crops: data ?? [] });
}
