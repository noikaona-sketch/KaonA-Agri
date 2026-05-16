import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// Returns seed products that are ready to reserve:
// product_type = seed, is_active = true, deleted_at = null, seed_variety_id IS NOT NULL
// seed_varieties without a linked active product must not appear here.
export async function GET() {
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('products')
    .select('id,name,brand,crop_type,days_to_harvest,bag_weight_kg,price_per_unit,seed_variety,image_url,product_type,is_active,seed_variety_id')
    .eq('product_type', 'seed')
    .eq('is_active', true)
    .is('deleted_at', null)
    .not('seed_variety_id', 'is', null)   // must be linked to Product Master variety
    .order('sort_order')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    lots: (data ?? []).map((p) => ({
      id:              p.id,
      product_id:      p.id,
      variety_name:    p.seed_variety ?? p.name,
      supplier_name:   p.brand        ?? '—',
      price_per_bag:   Number(p.price_per_unit ?? 0),
      bag_weight_kg:   Number(p.bag_weight_kg  ?? 1),
      crop_type:       p.crop_type      ?? '',
      days_to_harvest: p.days_to_harvest ?? null,
      image_url:       p.image_url       ?? null,
      seed_variety_id: p.seed_variety_id,
    })),
  });
}
