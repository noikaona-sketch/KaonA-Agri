import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id') ?? '';
  const s = createServerSupabaseClient();

  const [prodsRes, stockRes] = await Promise.all([
    s.from('products').select('id,name,category,unit,price_per_unit,is_active').is('deleted_at', null).eq('is_active', true).order('sort_order'),
    warehouseId
      ? s.from('product_stock').select('product_id,qty_available').eq('warehouse_id', warehouseId).not('product_id','is',null)
      : Promise.resolve({ data: [] }),
  ]);

  const stockMap = new Map(
    ((stockRes as { data: { product_id: string; qty_available: number }[] | null }).data ?? [])
      .map((ps) => [ps.product_id, ps.qty_available])
  );

  const items = (prodsRes.data ?? []).map((p) => ({
    id: p.id,
    type: 'product',
    product_id: p.id,
    name: p.name,
    category: p.category ?? 'อื่นๆ',
    supplier: '',
    image_url: null,
    unit: p.unit ?? 'ชิ้น',
    unit_price: p.price_per_unit,
    qty_available: stockMap.get(p.id) ?? 0,
    status: 'available',
  }));

  return NextResponse.json({ items });
}
