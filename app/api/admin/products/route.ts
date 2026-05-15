import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('products')
    .select('id,name,brand,category,product_type,unit,price_per_unit,stock_qty,is_low_stock,is_active,crop_type,seed_variety,sort_order')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
