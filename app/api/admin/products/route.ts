import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

type ProductCategory = 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'other';
type ProductType     = 'seed' | 'fertilizer' | 'chemical' | 'other';
const TYPE_BY_CAT: Record<ProductCategory, ProductType> = {
  seed: 'seed', fertilizer: 'fertilizer',
  pesticide: 'chemical', equipment: 'other', other: 'other',
};
const VALID_CATS:  ProductCategory[] = ['seed','fertilizer','pesticide','equipment','other'];
const VALID_TYPES: ProductType[]     = ['seed','fertilizer','chemical','other'];

const toCategory = (v: unknown): ProductCategory =>
  VALID_CATS.includes(v as ProductCategory) ? (v as ProductCategory) : 'other';
const toType = (v: unknown, cat: ProductCategory): ProductType =>
  VALID_TYPES.includes(v as ProductType) ? (v as ProductType) : TYPE_BY_CAT[cat];

export async function GET() {
  const _ar_get = await requireAdminPermission('seed.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const { data, error } = await s.from('products')
    .select('id,name,brand,category,product_type,product_code,unit,price_per_unit,stock_qty,is_active,seed_variety_id,crop_type,seed_variety,days_to_harvest,bag_weight_kg,sort_order')
    .is('deleted_at', null).order('sort_order').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

function buildPayload(body: Record<string, unknown>) {
  const cat     = toCategory(body.category);
  const type    = toType(body.product_type, cat);
  const isSeed  = type === 'seed';
  return {
    name:            String(body.name ?? '').trim(),
    category:        cat,
    product_type:    type,
    product_code:    body.product_code ? String(body.product_code).trim() : null,
    unit:            String(body.unit ?? 'piece'),
    price_per_unit:  Number(body.price_per_unit ?? 0),
    is_active:       Boolean(body.is_active ?? true),
    // seed-only fields — force null for non-seed
    seed_variety_id: isSeed ? (body.seed_variety_id as string | null ?? null) : null,
    crop_type:       isSeed ? (body.crop_type    ? String(body.crop_type).trim()    : null) : null,
    seed_variety:    isSeed ? (body.seed_variety ? String(body.seed_variety).trim() : null) : null,
    days_to_harvest: isSeed && body.days_to_harvest ? Number(body.days_to_harvest) : null,
    bag_weight_kg:   isSeed && body.bag_weight_kg   ? Number(body.bag_weight_kg)   : null,
  };
}

function seedError(p: ReturnType<typeof buildPayload>): string | null {
  // active seed must have seed_variety_id — enforce business rule at API level
  if (p.product_type === 'seed' && p.is_active && !p.seed_variety_id)
    return 'สินค้าเมล็ดพันธุ์ที่เปิดใช้งานต้องเลือกพันธุ์เมล็ด (seed_variety_id)';
  return null;
}

export async function POST(req: NextRequest) {
  const _ar_post = await requireAdminPermission('seed.write');
  if (isForbidden(_ar_post)) return _ar_post.forbidden;
  const body    = await req.json() as Record<string, unknown>;
  const payload = buildPayload(body);
  if (!payload.name)         return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const err = seedError(payload);
  if (err)                   return NextResponse.json({ error: err }, { status: 400 });
  const s = createServerSupabaseClient();
  const { data, error } = await s.from('products').insert(payload).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, product: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const _ar_patch = await requireAdminPermission('seed.write');
  if (isForbidden(_ar_patch)) return _ar_patch.forbidden;
  const body = await req.json() as Record<string, unknown>;
  const id   = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const payload = buildPayload(body);
  const err = seedError(payload);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const s = createServerSupabaseClient();
  const { error } = await s.from('products').update(payload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
