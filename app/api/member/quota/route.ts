import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ACTIVE_STATUSES = ['registered','approved','planted','harvesting'];

export async function GET(request: Request) {
  try {
    const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '') || null;
    if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });

    const s = createServerSupabaseClient();
    const { data: { user } } = await s.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 });

    const { data: memberRow } = await s
      .from('members').select('id').eq('auth_user_id', user.id).maybeSingle();

    if (!memberRow) {
      return NextResponse.json(
        { quota_ton: null, quota_kg: 0, cycle_count: 0, cycles: [] },
        { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' } }
      );
    }

    const { data, error } = await s
      .from('planting_cycles')
      .select('id,season_year,status,quota_kg,crop_name')
      .eq('member_id', (memberRow as { id: string }).id)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cycles = (data ?? []) as { id: string; season_year: number; status: string; quota_kg: number | null; crop_name: string | null }[];
    const totalKg  = cycles.reduce((s, c) => s + Number(c.quota_kg ?? 0), 0);
    const totalTon = totalKg > 0 ? +(totalKg / 1000).toFixed(2) : null;

    return NextResponse.json(
      {
        quota_ton: totalTon, quota_kg: totalKg, cycle_count: cycles.length,
        cycles: cycles.map((c) => ({
          id: c.id, season_year: c.season_year, status: c.status,
          crop_name: c.crop_name,
          quota_kg: Number(c.quota_kg ?? 0),
          quota_ton: +(Number(c.quota_kg ?? 0) / 1000).toFixed(2),
        })),
      },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
