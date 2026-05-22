import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const _ar = await requireAdminPermission('market_prices.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { data, error } = await createServerSupabaseClient()
    .from('moisture_deductions')
    .select('id,crop_type,moisture_pct,weight_deduct_pct,price_deduct_per_kg,drying_days_per_pct,note,is_active')
    .order('moisture_pct', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('market_prices.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const body = (await request.json()) as {
      crop_type?: string; moisture_pct: number;
      weight_deduct_pct: number; price_adjust_per_kg: number;
      drying_days_per_pct?: number; note?: string;
    };
    if (body.moisture_pct == null) return NextResponse.json({ error: 'moisture_pct จำเป็น' }, { status: 400 });
    const s = createServerSupabaseClient();
    const { error } = await s.from('moisture_deductions').upsert({
      crop_type:            body.crop_type ?? 'ข้าวโพด',
      moisture_pct:         body.moisture_pct,
      weight_deduct_pct:    body.weight_deduct_pct ?? 0,
      price_adjust_per_kg:  body.price_adjust_per_kg ?? 0,
      drying_days_per_pct:  body.drying_days_per_pct ?? 1,
      note:                 body.note ?? null,
      is_active:            true,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'crop_type,moisture_pct' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const _ar = await requireAdminPermission('market_prices.write');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });
  const { error } = await createServerSupabaseClient()
    .from('moisture_deductions').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
