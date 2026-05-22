import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/sales-by-product?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url  = new URL(request.url);
  const to   = url.searchParams.get('to')   ?? new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get('from') ?? new Date(new Date(to).getTime() - 29 * 86400_000).toISOString().slice(0, 10);

  const s = createServerSupabaseClient();

  // ดึง order_items + ข้อมูล order + product ในช่วงวันที่
  const { data, error } = await s
    .from('order_items')
    .select(`
      qty, unit_price, subtotal,
      product:products!order_items_product_id_fkey(id, name, category, unit),
      order:sale_orders!order_items_order_id_fkey(created_at, status, order_type)
    `)
    .in('order->status' as 'id', ['completed', 'confirmed'])
    .gte('order->created_at' as 'id', `${from}T00:00:00`)
    .lte('order->created_at' as 'id', `${to}T23:59:59`);

  if (error) {
    // fallback: ดึงผ่าน sale_orders ก่อนแล้ว join
    const { data: orders, error: ordErr } = await s
      .from('sale_orders')
      .select('id,created_at,status,total,order_items(qty,unit_price,subtotal,product:products(id,name,category,unit))')
      .in('status', ['completed','confirmed'])
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .eq('order_type', 'sale');

    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

    // รวมตาม product + วัน
    type Row = { date: string; product_id: string; product_name: string; category: string; unit: string; qty: number; revenue: number; order_count: number };
    const map: Record<string, Row> = {};
    (orders ?? []).forEach((o) => {
      const date = (o.created_at as string).slice(0, 10);
      (o.order_items as unknown as { qty: number; subtotal: number; product: { id: string; name: string; category: string; unit: string } | null }[] ?? []).forEach((item) => {
        if (!item.product) return;
        const key = `${date}__${item.product.id}`;
        if (!map[key]) map[key] = { date, product_id: item.product.id, product_name: item.product.name, category: item.product.category, unit: item.product.unit, qty: 0, revenue: 0, order_count: 0 };
        map[key].qty         += item.qty;
        map[key].revenue     += item.subtotal ?? 0;
        map[key].order_count += 1;
      });
    });

    const rows = Object.values(map).sort((a, b) => b.date.localeCompare(a.date) || b.revenue - a.revenue);

    // สรุปตาม product (ไม่แยกวัน)
    const byProduct: Record<string, { product_name: string; category: string; unit: string; total_qty: number; total_revenue: number }> = {};
    rows.forEach((r) => {
      if (!byProduct[r.product_id]) byProduct[r.product_id] = { product_name: r.product_name, category: r.category, unit: r.unit, total_qty: 0, total_revenue: 0 };
      byProduct[r.product_id].total_qty     += r.qty;
      byProduct[r.product_id].total_revenue += r.revenue;
    });

    return NextResponse.json({
      from, to,
      daily: rows,
      by_product: Object.entries(byProduct).map(([id, v]) => ({ product_id: id, ...v })).sort((a, b) => b.total_revenue - a.total_revenue),
    });
  }

  return NextResponse.json({ from, to, daily: data ?? [] });
}
