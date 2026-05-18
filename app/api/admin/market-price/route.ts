import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('market_prices.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const { data } = await s.from('market_prices')
    .select('id,crop_type,price_per_kg,moisture_pct,price_type,effective_date,note,is_active')
    .order('effective_date', { ascending: false }).limit(50);
  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(request: Request) {
  try {
  const _ar_post = await requireAdminPermission('market_prices.write');
  if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as {
      crop_type: string; price_per_kg: number;
      moisture_pct?: number | null; price_type?: string; note?: string;
    };
    if (!body.crop_type || !body.price_per_kg)
      return NextResponse.json({ error: 'crop_type และ price_per_kg จำเป็น' }, { status: 400 });

    const priceType = body.price_type ?? 'market';
    const s = createServerSupabaseClient();

    // deactivate ราคาเดิมที่ตรงกับ crop + moisture + price_type
    let deactivateQ = s.from('market_prices').update({ is_active: false })
      .eq('crop_type', body.crop_type)
      .eq('price_type', priceType)
      .eq('is_active', true);

    // ถ้ามี moisture ให้ deactivate เฉพาะความชื้นเดียวกัน
    if (body.moisture_pct !== null && body.moisture_pct !== undefined) {
      deactivateQ = deactivateQ.eq('moisture_pct', body.moisture_pct);
    } else {
      deactivateQ = deactivateQ.is('moisture_pct', null);
    }
    await deactivateQ;

    const { error } = await s.from('market_prices').insert({
      crop_type:      body.crop_type,
      price_per_kg:   body.price_per_kg,
      moisture_pct:   body.moisture_pct ?? null,
      price_type:     priceType,
      effective_date: new Date().toISOString().slice(0, 10),
      note:           body.note ?? null,
      is_active:      true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
