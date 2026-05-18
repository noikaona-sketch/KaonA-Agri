import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export async function GET(request: Request) {
  const _ar_get = await requireAdminPermission('service.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id') ?? '';
  const mode        = searchParams.get('mode') ?? 'sale';

  const s = createServerSupabaseClient();

  let stockQuery = s.from('product_stock')
    .select(`
      id, qty_on_hand, qty_available, qty_reserved, unit,
      products(
        id, name, category, unit, price_per_unit,
        product_type, seed_variety_id,
        seed_varieties(variety_name, crop_type, days_to_harvest, image_url, mentor_name)
      )
    `)
    .not('product_id', 'is', null)
    .gt('qty_available', 0);

  if (warehouseId) stockQuery = stockQuery.eq('warehouse_id', warehouseId);

  const { data: stockData } = await stockQuery;

  type SeedVariety = { variety_name: string; crop_type: string; days_to_harvest: number | null; image_url: string | null; mentor_name: string | null };
  type ProductRow = { id: string; name: string; category: string; unit: string; price_per_unit: number; product_type: string; seed_variety_id: string | null; seed_varieties: SeedVariety | null };
  type StockRow = { id: string; qty_on_hand: number; qty_available: number; unit: string; products: ProductRow | null };

  const allItems = ((stockData ?? []) as unknown as StockRow[])
    .filter((s) => !!s.products)
    .map((s) => {
      const p  = s.products!;
      const sv = p.seed_varieties;
      return {
        id:            s.id,
        product_id:    p.id,
        name:          p.name,
        category:      p.category ?? p.product_type,
        product_type:  p.product_type,
        unit:          s.unit || p.unit || 'ชิ้น',
        unit_price:    p.price_per_unit,
        qty_available: s.qty_available,
        qty_on_hand:   s.qty_on_hand,
        variety_name:    sv?.variety_name    ?? null,
        crop_type:       sv?.crop_type       ?? null,
        days_to_harvest: sv?.days_to_harvest ?? null,
        image_url:       sv?.image_url       ?? null,
        mentor_name:     sv?.mentor_name     ?? null,
        seed_variety_id: p.seed_variety_id   ?? null,
      };
    });

  const items = mode === 'reservation'
    ? allItems.filter((i) => i.product_type === 'seed')
    : allItems;

  return NextResponse.json({ items });
}
