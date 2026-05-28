import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';
import { isSeedProductMatchingCrop }  from '@/lib/products/corn-seed';

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

type SaleOrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string | null;
  qty: number;
  created_at: string;
  product: ProductRow | ProductRow[] | null;
};

function singleProduct(product: ProductRow | ProductRow[] | null | undefined) {
  return Array.isArray(product) ? product[0] ?? null : product ?? null;
}

export async function GET(request: Request) {
  try {
    const s            = createServerSupabaseClient();
    const searchParams = new URL(request.url).searchParams;
    const memberId     = searchParams.get('member_id') ?? undefined;
    const cropType     = searchParams.get('crop_type');
    const caller       = await resolveApprovedMember(request, s, memberId);
    if (!caller.ok) return caller.response;

    if (!cropType) return NextResponse.json({ items: [] });

    const { data: saleRows, error: saleError } = await s
      .from('sale_orders')
      .select('id, order_number, created_at')
      .eq('member_id', caller.memberId)
      .eq('order_type', 'sale')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100);

    if (saleError) return NextResponse.json({ error: saleError.message }, { status: 500 });
    const saleOrders = (saleRows as SaleOrderRow[] | null) ?? [];
    if (!saleOrders.length) return NextResponse.json({ items: [] });

    const orderMap = new Map(saleOrders.map((order) => [order.id, order]));
    const orderIds = saleOrders.map((order) => order.id);

    const { data: itemRows, error: itemError } = await s
      .from('order_items')
      .select(`
        id, order_id, qty, created_at,
        product:product_id(id, name, category, product_type, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

    const items = ((itemRows as OrderItemRow[] | null) ?? [])
      .filter((item) => {
        const product = singleProduct(item.product);
        return Boolean(item.order_id && orderMap.has(item.order_id) && isSeedProductMatchingCrop({
          category:     product?.category,
          product_type: product?.product_type,
          crop_type:    product?.crop_type,
          name:         product?.name,
        }, cropType));
      })
      .map((item) => {
        const order = orderMap.get(item.order_id!)!;
        const product = singleProduct(item.product);
        const bagKg = product?.bag_weight_kg ?? 10;
        const ratio = product?.yield_ratio_kg ?? 600;
        return {
          id:              item.id,
          order_number:    order.order_number ?? `SALE-${order.id.slice(0, 8)}`,
          created_at:      order.created_at || item.created_at,
          product_id:      product?.id ?? null,
          product_name:    product?.name ?? '—',
          qty:             item.qty,
          bag_weight_kg:   bagKg,
          days_to_harvest: product?.days_to_harvest ?? null,
          yield_ratio_kg:  ratio,
          crop_type:       product?.crop_type ?? null,
          variety_name:    product?.name ?? null,
          category:        product?.category ?? null,
          product_type:    product?.product_type ?? null,
        };
      });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
