import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

type ProductCategory = 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'other';
type ProductType = 'seed' | 'fertilizer' | 'chemical' | 'other';

const PRODUCT_TYPE_BY_CATEGORY: Record<ProductCategory, ProductType> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'chemical',
  equipment: 'other',
  other: 'other',
};

function toValidCategory(value: unknown): ProductCategory {
  const allowed: ProductCategory[] = ['seed', 'fertilizer', 'pesticide', 'equipment', 'other'];
  return allowed.includes(value as ProductCategory) ? (value as ProductCategory) : 'other';
}

function toValidProductType(value: unknown, category: ProductCategory): ProductType {
  const allowed: ProductType[] = ['seed', 'fertilizer', 'chemical', 'other'];
  return allowed.includes(value as ProductType) ? (value as ProductType) : PRODUCT_TYPE_BY_CATEGORY[category];
}

export async function GET() {
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('products')
    .select('id,name,brand,category,product_type,unit,price_per_unit,stock_qty,is_active,crop_type,seed_variety,sort_order')
    .is('deleted_at', null)
    .order('sort_order')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const category = toValidCategory(body.category);
  const payload = {
    name: String(body.name ?? '').trim(),
    category,
    product_type: toValidProductType(body.product_type, category),
    unit: String(body.unit ?? 'piece'),
    price_per_unit: Number(body.price_per_unit ?? 0),
    is_active: Boolean(body.is_active ?? true),
  };
  if (!payload.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const s = createServerSupabaseClient();
  const { data, error } = await s.from('products').insert(payload).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, product: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const category = toValidCategory(body.category);
  const payload = {
    name: String(body.name ?? '').trim(),
    category,
    product_type: toValidProductType(body.product_type, category),
    unit: String(body.unit ?? 'piece'),
    price_per_unit: Number(body.price_per_unit ?? 0),
    is_active: Boolean(body.is_active ?? true),
  };

  const s = createServerSupabaseClient();
  const { error } = await s.from('products').update(payload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
