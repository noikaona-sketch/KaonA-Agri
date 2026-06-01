import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/member/planting-seasons — รอบที่เปิดรับอยู่
export async function GET() {
  const s     = createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await s
    .from('planting_seasons')
    .select('id,name,season_year,crop_type,planting_start,planting_end,harvest_start,harvest_end,noburn_bonus_type,noburn_bonus_value,seed_quota_kg')
    .eq('is_active', true)
    .or(`registration_opens.is.null,registration_opens.lte.${today}`)
    .or(`registration_closes.is.null,registration_closes.gte.${today}`)
    .order('planting_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}
