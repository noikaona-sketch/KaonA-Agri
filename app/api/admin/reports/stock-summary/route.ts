import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/stock-summary
// สรุปสต็อกปัจจุบัน + การเคลื่อนไหว 30 วันที่ผ่านมา
export async function GET() {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const s    = createServerSupabaseClient();
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [stockRes, movRes] = await Promise.all([
    // สต็อกปัจจุบันต่อสินค้า
    s.from('product_stock')
      .select('product_id,qty_available,qty_reserved,qty_sold,products!product_stock_product_id_fkey(name,category,unit,price_per_unit)')
      .order('qty_available', { ascending: false }),

    // การเคลื่อนไหว 30 วัน
    s.from('stock_movements')
      .select('product_id,movement_type,qty,created_at,products!stock_movements_product_id_fkey(name,unit)')
      .gte('created_at', `${from}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (stockRes.error) return NextResponse.json({ error: stockRes.error.message }, { status: 500 });

  type StockRow = typeof stockRes.data extends (infer T)[] | null ? T : never;
  type MovRow   = typeof movRes.data extends (infer T)[] | null ? T : never;

  const stock = (stockRes.data ?? []) as StockRow[];
  const moves = (movRes.data  ?? []) as MovRow[];

  // สรุปเข้า/ออกต่อสินค้าใน 30 วัน
  const movSummary: Record<string, { in: number; out: number }> = {};
  moves.forEach((m) => {
    const pid = m.product_id as string;
    if (!movSummary[pid]) movSummary[pid] = { in: 0, out: 0 };
    const qty = Number(m.qty ?? 0);
    if ((m.movement_type as string) === 'in') movSummary[pid].in  += qty;
    else                                       movSummary[pid].out += qty;
  });

  const stockWithMovement = stock.map((s) => {
    const pid = s.product_id as string;
    const p   = s.products as unknown as { name: string; category: string; unit: string; price_per_unit: number } | null;
    return {
      product_id:    pid,
      product_name:  p?.name ?? '—',
      category:      p?.category ?? '—',
      unit:          p?.unit ?? '—',
      price_per_unit:Number(p?.price_per_unit ?? 0),
      qty_available: Number(s.qty_available ?? 0),
      qty_reserved:  Number(s.qty_reserved  ?? 0),
      qty_sold:      Number(s.qty_sold      ?? 0),
      stock_value:   Number(s.qty_available ?? 0) * Number(p?.price_per_unit ?? 0),
      in_30d:        movSummary[pid]?.in  ?? 0,
      out_30d:       movSummary[pid]?.out ?? 0,
    };
  });

  const totalValue = stockWithMovement.reduce((s, r) => s + r.stock_value, 0);

  return NextResponse.json({ stock: stockWithMovement, total_stock_value: totalValue, as_of: new Date().toISOString() });
}
