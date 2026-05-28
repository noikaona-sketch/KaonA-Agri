import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const s        = createServerSupabaseClient();
    const memberId = new URL(request.url).searchParams.get('member_id') ?? undefined;
    const caller   = await resolveApprovedMember(request, s, memberId);
    if (!caller.ok) return caller.response;

    // ดึงจาก stock_movements ที่อ้างอิง sale_orders ของ member นี้เท่านั้น
    const { data: movements } = await s
      .from('stock_movements')
      .select(`
        id, movement_no, qty, unit, ref_type, ref_id, created_at,
        products:product_id(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
      `)
      .in('movement_type', ['out','sale'])
      .in('ref_type', ['sale','sale_order'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (!movements?.length) return NextResponse.json({ items: [] });

    // หา sale_order refs ของ member นี้เท่านั้น
    const saleIds = movements.map(m => m.ref_id).filter(Boolean) as string[];

    const { data: saleRows } = saleIds.length
      ? await s.from('sale_orders').select('id, order_number, member_id').in('id', saleIds).eq('member_id', caller.memberId)
      : { data: [] };

    type Ref = { id:string; order_number?:string; member_id:string };
    const refMap = new Map<string, Ref>();
    (saleRows ?? []).forEach((r: unknown) => {
      const row = r as Ref;
      if (row.id) refMap.set(row.id, row);
    });

    // filter เฉพาะ movement ที่เป็นของ member นี้
    const items = movements
      .filter(m => m.ref_id && refMap.has(m.ref_id))
      .map(m => {
        const ref = refMap.get(m.ref_id!)!;
        const p   = m.products as unknown as Record<string,unknown>|null;
        const bagKg = (p?.bag_weight_kg as number) ?? 10;
        const ratio = (p?.yield_ratio_kg as number) ?? 600;
        return {
          id:             m.id,
          order_number:   ref.order_number ?? m.movement_no,
          created_at:     m.created_at,
          product_id:     p?.id as string ?? null,
          product_name:   p?.name as string ?? '—',
          qty:            m.qty,
          bag_weight_kg:  bagKg,
          days_to_harvest:(p?.days_to_harvest as number) ?? null,
          yield_ratio_kg: ratio,
          crop_type:      p?.crop_type as string ?? 'ข้าวโพด',
          variety_name:   p?.name as string ?? null,
        };
      });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
