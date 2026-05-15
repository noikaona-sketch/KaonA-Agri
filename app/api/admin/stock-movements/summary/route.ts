import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id');

  const s = createServerSupabaseClient();
  let q = s.from('product_stock')
    .select(`
      id, qty_on_hand, qty_reserved, qty_available, unit, updated_at,
      warehouses(id, code, name),
      products(id, name, category, unit, price_per_unit),
      seed_varieties(id, variety_name, crop_type, price_per_bag, bag_weight_kg)
    `)
    .order('updated_at', { ascending: false });

  if (warehouseId) q = q.eq('warehouse_id', warehouseId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stock: data ?? [] });
}
