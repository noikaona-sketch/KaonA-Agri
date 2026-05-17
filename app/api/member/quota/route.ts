// คำนวณโควต้าของสมาชิกจาก seed_reservations
// สูตร: qty_reserved × bag_weight_kg × yield_ratio ÷ 1000 = ตัน
// นับเฉพาะ status ที่ยังมีผล: pending, confirmed, partial

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'partial'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ quota_ton: 0, reservations: [] });

    const s = createServerSupabaseClient();

    // ดึง seed_reservations พร้อม yield_ratio จาก seed_varieties
    const { data, error } = await s
      .from('seed_reservations')
      .select(`
        id,
        reservation_no,
        status,
        qty_reserved,
        variety_name,
        seed_varieties!seed_reservations_seed_variety_id_fkey (
          yield_ratio,
          bag_weight_kg
        )
      `)
      .eq('member_id', memberId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as {
      id: string; reservation_no: string; status: string;
      qty_reserved: number; variety_name: string;
      seed_varieties: { yield_ratio: number | null; bag_weight_kg: number } | null;
    }[];

    // คำนวณโควต้ารวม
    let totalKg = 0;
    const reservations = rows.map((r) => {
      const yieldRatio   = Number(r.seed_varieties?.yield_ratio ?? 0);
      const bagWeightKg  = Number(r.seed_varieties?.bag_weight_kg ?? 0);
      const qtyReserved  = Number(r.qty_reserved ?? 0);
      const quotaKg      = qtyReserved * bagWeightKg * yieldRatio;
      totalKg           += quotaKg;
      return {
        reservation_no: r.reservation_no,
        status:         r.status,
        variety_name:   r.variety_name,
        qty_reserved:   qtyReserved,
        quota_kg:       quotaKg,
        quota_ton:      +(quotaKg / 1000).toFixed(2),
      };
    });

    return NextResponse.json({
      quota_kg:     totalKg,
      quota_ton:    +(totalKg / 1000).toFixed(2),
      count:        rows.length,
      reservations,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
