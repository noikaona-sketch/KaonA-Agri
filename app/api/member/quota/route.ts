// โควต้าของสมาชิก — คำนวณจาก planting_cycles.quota_kg
// Security: member_id derived from Supabase auth.uid() via Bearer token
// ไม่รับ member_id จาก query string — ป้องกัน IDOR

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ACTIVE_STATUSES = ['registered','approved','planted','harvesting'];

export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();

    // ── Derive member from Bearer token (session) ─────────────────────
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let authUid: string | null = null;

    if (token) {
      // ตรวจ token กับ Supabase เพื่อรับ user.id
      const { data: { user } } = await s.auth.getUser(token);
      authUid = user?.id ?? null;
    }

    if (!authUid) {
      // ถ้าไม่มี Bearer token → ไม่มีสิทธิ์
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    // lookup member by auth_user_id (server-side, ไม่ trust query param)
    const { data: memberRow } = await s
      .from('members')
      .select('id')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (!memberRow) {
      // member ยังไม่ได้ link session → return empty ไม่ error
      return NextResponse.json({ quota_ton: null, cycles: [], cycle_count: 0 });
    }

    const memberId = (memberRow as { id: string }).id;

    // ── Query planting cycles ─────────────────────────────────────────
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

    const totalKg  = cycles.reduce((sum, c) => sum + Number(c.quota_kg ?? 0), 0);
    const totalTon = totalKg > 0 ? +(totalKg / 1000).toFixed(2) : null;

    return NextResponse.json({
      quota_ton:   totalTon,
      quota_kg:    totalKg,
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
