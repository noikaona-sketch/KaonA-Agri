import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

// GET /api/member/sale-items?member_id=xxx
// ดึงรายการบิลขาย/จองเมล็ดพันธุ์ของ member สำหรับเลือกในรอบปลูก
export async function GET(request: Request) {
  try {
    const s         = createServerSupabaseClient();
    const memberId  = new URL(request.url).searchParams.get('member_id') ?? undefined;
    const caller    = await resolveApprovedMember(request, s, memberId);
    if (!caller.ok) return caller.response;

    // ดึง order_items ที่เป็น seed ของ member นี้
    const { data, error } = await s
      .from('order_items')
      .select(`
        id,
        qty,
        unit_price,
        product_id,
        product_name,
        sale_orders!inner(
          id, order_number, status, order_type, created_at, member_id
        ),
        products(
          id, name, bag_weight_kg, days_to_harvest,
          yield_ratio_kg, crop_type, seed_variety,
          seed_varieties:seed_variety_id(variety_name)
        )
      `)
      .eq('sale_orders.member_id', caller.memberId)
      .in('sale_orders.status', ['completed','confirmed','ready'])
      .eq('sale_orders.order_type', 'seed')
      .not('products', 'is', null)
      .order('sale_orders.created_at', { ascending: false })
      .limit(50);

    if (error) {
      // fallback: ลอง query แบบอื่น ถ้า seed order_type ไม่มี
      const { data: data2 } = await s
        .from('seed_reservations')
        .select(`
          id, reservation_no, qty_reserved, variety_name, created_at, status,
          products:product_id(
            id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type
          )
        `)
        .eq('member_id', caller.memberId)
        .in('status', ['confirmed','completed','received'])
        .order('created_at', { ascending: false })
        .limit(50);

      const items = (data2 ?? []).map((r: Record<string,unknown>) => ({
        id:             r.id,
        order_number:   r.reservation_no,
        created_at:     r.created_at,
        product_id:     (r.products as Record<string,unknown>)?.id ?? null,
        product_name:   r.variety_name ?? (r.products as Record<string,unknown>)?.name,
        qty:            r.qty_reserved,
        unit_price:     0,
        bag_weight_kg:  (r.products as Record<string,unknown>)?.bag_weight_kg ?? 10,
        days_to_harvest:(r.products as Record<string,unknown>)?.days_to_harvest ?? null,
        yield_ratio_kg: (r.products as Record<string,unknown>)?.yield_ratio_kg ?? 600,
        crop_type:      (r.products as Record<string,unknown>)?.crop_type ?? 'corn',
        variety_name:   r.variety_name as string|null,
      }));
      return NextResponse.json({ items });
    }

    const items = (data ?? []).map((r: Record<string,unknown>) => {
      const order    = (r.sale_orders as Record<string,unknown>);
      const product  = (r.products   as Record<string,unknown>);
      const variety  = (product?.seed_varieties as Record<string,unknown>);
      return {
        id:             r.id,
        order_number:   order?.order_number,
        created_at:     order?.created_at,
        product_id:     r.product_id,
        product_name:   r.product_name ?? product?.name,
        qty:            r.qty,
        unit_price:     r.unit_price,
        bag_weight_kg:  product?.bag_weight_kg ?? 10,
        days_to_harvest:product?.days_to_harvest ?? null,
        yield_ratio_kg: product?.yield_ratio_kg ?? 600,
        crop_type:      product?.crop_type ?? 'corn',
        variety_name:   variety?.variety_name ?? product?.seed_variety ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
