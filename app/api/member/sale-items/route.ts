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

    // Source 1: seed_reservations (จองเมล็ด)
    const { data: seeds } = await s
      .from('seed_reservations')
      .select(`
        id, reservation_no, qty_reserved, variety_name, created_at, status,
        products:product_id(
          id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type
        )
      `)
      .eq('member_id', caller.memberId)
      .in('status', ['confirmed','completed','received','pending'])
      .order('created_at', { ascending: false })
      .limit(30);

    // Source 2: sale_orders ที่มี seed products (ซื้อโดยตรง)
    const { data: orders } = await s
      .from('order_items')
      .select(`
        id, qty, unit_price, product_id, product_name,
        sale_orders!inner(id, order_number, status, created_at, member_id),
        products(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type, product_type)
      `)
      .eq('sale_orders.member_id', caller.memberId)
      .in('sale_orders.status', ['completed','confirmed','ready'])
      .eq('products.product_type', 'seed')
      .order('sale_orders.created_at', { ascending: false })
      .limit(30);

    const items: Record<string,unknown>[] = [];

    // map seed_reservations
    for (const r of seeds ?? []) {
      const p = r.products as unknown as Record<string,unknown> | null;
      items.push({
        id:             r.id,
        order_number:   r.reservation_no,
        created_at:     r.created_at,
        product_id:     p?.id ?? null,
        product_name:   r.variety_name ?? p?.name ?? '—',
        qty:            r.qty_reserved,
        bag_weight_kg:  p?.bag_weight_kg ?? 10,
        days_to_harvest:p?.days_to_harvest ?? null,
        yield_ratio_kg: p?.yield_ratio_kg ?? 600,
        crop_type:      p?.crop_type ?? 'ข้าวโพด',
        variety_name:   r.variety_name as string|null,
      });
    }

    // map sale_orders (ไม่ duplicate)
    const existingIds = new Set(items.map(x => x.product_id));
    for (const r of orders ?? []) {
      const p = r.products as unknown as Record<string,unknown> | null;
      const o = r.sale_orders as unknown as Record<string,unknown>;
      if (!p || existingIds.has(p.id)) continue; // skip ถ้ามีใน seed_reservations แล้ว
      items.push({
        id:             r.id,
        order_number:   o?.order_number,
        created_at:     o?.created_at,
        product_id:     r.product_id,
        product_name:   r.product_name ?? p?.name ?? '—',
        qty:            r.qty,
        bag_weight_kg:  p?.bag_weight_kg ?? 10,
        days_to_harvest:p?.days_to_harvest ?? null,
        yield_ratio_kg: p?.yield_ratio_kg ?? 600,
        crop_type:      p?.crop_type ?? 'ข้าวโพด',
        variety_name:   p?.name as string|null,
      });
    }

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
