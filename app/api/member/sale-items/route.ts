import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

type ProductRow = {
  id: string;
  name: string | null;
  category: string | null;
  product_type: string | null;
  bag_weight_kg: number | null;
  days_to_harvest: number | null;
  yield_ratio_kg: number | null;
  crop_type: string | null;
};

type OrderItemRow = {
  id: string;
  qty: number;
  created_at: string | null;
  product_name: string | null;
  product_name_snapshot: string | null;
  product_id: string | null;
  product: ProductRow | null;
};

type SaleOrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  order_items: OrderItemRow[] | null;
};

export async function GET(request: Request) {
  try {
    const s        = createServerSupabaseClient();
    const memberId = new URL(request.url).searchParams.get('member_id') ?? undefined;
    const caller   = await resolveApprovedMember(request, s, memberId);
    if (!caller.ok) return caller.response;

    // Source of truth: completed sale_orders(order_type='sale') + order_items for this member.
    // Do not include stock_movements or reservation refs here because reservations are not actual sales.
    const { data: saleOrders, error } = await s
      .from('sale_orders')
      .select(`
        id, order_number, created_at,
        order_items(
          id, qty, created_at, product_name, product_name_snapshot, product_id,
          product:products(id, name, category, product_type, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
        )
      `)
      .eq('member_id', caller.memberId)
      .eq('order_type', 'sale')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!saleOrders?.length) return NextResponse.json({ items: [] });

    const items = (saleOrders as unknown as SaleOrderRow[]).flatMap((order) => {
      return (order.order_items ?? [])
        .filter((item) => item.product?.category === 'seed' || item.product?.product_type === 'seed')
        .map((item) => {
          const p = item.product;
          const bagKg = p?.bag_weight_kg ?? 10;
          const ratio = p?.yield_ratio_kg ?? 600;
          const productName = p?.name ?? item.product_name_snapshot ?? item.product_name ?? '—';

          return {
            id:             item.id,
            order_number:   order.order_number ?? `SALE-${order.id.slice(0, 8)}`,
            created_at:     order.created_at || item.created_at,
            product_id:     item.product_id ?? p?.id ?? null,
            product_name:   productName,
            qty:            item.qty,
            bag_weight_kg:  bagKg,
            days_to_harvest:p?.days_to_harvest ?? null,
            yield_ratio_kg: ratio,
            crop_type:      p?.crop_type ?? 'ข้าวโพด',
            variety_name:   productName,
          };
        });
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
