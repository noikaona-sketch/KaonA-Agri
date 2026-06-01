import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/member/no-burn/seasons — รอบที่เปิดอยู่ สำหรับสมาชิกเลือก
export async function GET() {
  const s = createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await s
    .from('no_burn_seasons')
    .select('id,name,season_year,starts_at,ends_at,crop_type,bonus_type,bonus_value')
    .eq('is_active', true)
    .lte('starts_at', today)
    .gte('ends_at', today)
    .order('starts_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}
