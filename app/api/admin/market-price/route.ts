import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s.from('market_prices')
    .select('*').order('effective_date', { ascending: false }).limit(50);
  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      crop_type: string; price_per_kg: number; note?: string;
    };
    const s = createServerSupabaseClient();
    // deactivate ราคาเดิมของ crop นี้ก่อน
    await s.from('market_prices').update({ is_active: false })
      .eq('crop_type', body.crop_type).eq('is_active', true);
    // เพิ่มราคาใหม่
    const { error } = await s.from('market_prices').insert({
      crop_type:      body.crop_type,
      price_per_kg:   body.price_per_kg,
      effective_date: new Date().toISOString().slice(0, 10),
      note:           body.note ?? null,
      is_active:      true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
