import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id') ?? '';
  const s = createServerSupabaseClient();

  const [lotsRes, prodsRes, stockRes] = await Promise.all([
    s.from('seed_stock_lots')
      .select('id,lot_no,variety_name,quantity_balance,bag_weight_kg,price_per_bag,status,variety_id,seed_varieties(crop_type,image_url),seed_suppliers(supplier_name)')
      .in('status', ['available','low'])
      .gt('quantity_balance', 0)
      .order('variety_name'),
    s.from('products')
      .select('id,name,category,unit,price_per_unit')
      .is('deleted_at', null).eq('is_active', true).order('sort_order'),
    warehouseId
      ? s.from('product_stock').select('product_id,qty_available').eq('warehouse_id', warehouseId).not('product_id','is',null)
      : Promise.resolve({ data: [] }),
  ]);

  const stockMap = new Map(
    ((stockRes as { data: { product_id: string; qty_available: number }[] | null }).data ?? [])
      .map((ps) => [ps.product_id, ps.qty_available])
  );

  const seeds = (lotsRes.data ?? []).map((l) => ({
    id: l.id, type: 'seed', variety_id: l.variety_id, lot_id: l.id, lot_no: l.lot_no,
    name: l.variety_name,
    category: (l.seed_varieties as { crop_type: string } | null)?.crop_type ?? 'เมล็ดพันธุ์',
    supplier: (l.seed_suppliers as { supplier_name: string } | null)?.supplier_name ?? '',
    image_url: (l.seed_varieties as { image_url: string | null } | null)?.image_url ?? null,
    unit: 'ถุง', unit_price: l.price_per_bag, bag_weight: l.bag_weight_kg,
    qty_available: l.quantity_balance, status: l.status,
  }));

  const products = (prodsRes.data ?? []).map((p) => ({
    id: p.id, type: 'product', product_id: p.id,
    name: p.name, category: p.category ?? 'อื่นๆ', supplier: '',
    image_url: null, unit: p.unit ?? 'ชิ้น', unit_price: p.price_per_unit,
    qty_available: stockMap.get(p.id) ?? 0, status: 'available',
  }));

  return NextResponse.json({ items: [...seeds, ...products] });
}
