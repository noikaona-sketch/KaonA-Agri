// โควต้าของสมาชิก — คำนวณจาก planting_cycles.quota_kg
// โชว์เฉพาะเมื่อมีรอบปลูกที่ active (ไม่ใช่ cancelled)
// quota_kg ถูก set โดย:
//   - POS ตอนขายเมล็ด (auto)
//   - Admin อนุมัติรอบปลูกหลังบ้าน (manual)

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ACTIVE_STATUSES = ['registered','approved','planted','harvesting'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ quota_ton: null, cycles: [] });

    const s = createServerSupabaseClient();

    const { data, error } = await s
      .from('planting_cycles')
      .select('id,season_year,status,quota_kg,crop_name,planted_at')
      .eq('member_id', memberId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cycles = (data ?? []) as {
      id: string; season_year: number; status: string;
      quota_kg: number | null; crop_name: string | null; planted_at: string | null;
    }[];

    // รวม quota_kg ทุกรอบที่ active
    const totalKg  = cycles.reduce((s, c) => s + Number(c.quota_kg ?? 0), 0);
    const totalTon = totalKg > 0 ? +(totalKg / 1000).toFixed(2) : null;

    return NextResponse.json({
      quota_ton:  totalTon,        // null = ยังไม่มีรอบปลูก → ไม่โชว์
      quota_kg:   totalKg,
      cycle_count: cycles.length,
      cycles: cycles.map((c) => ({
        id:          c.id,
        season_year: c.season_year,
        status:      c.status,
        crop_name:   c.crop_name,
        quota_kg:    Number(c.quota_kg ?? 0),
        quota_ton:   +(Number(c.quota_kg ?? 0) / 1000).toFixed(2),
        planted_at:  c.planted_at,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
