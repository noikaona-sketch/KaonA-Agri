import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../auth/line/line-auth-helpers';

export async function GET() {
  try {
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('market_prices')
      .select('id,crop_type,price_per_kg,moisture_pct,price_type,effective_date')
      .eq('is_active', true)
      .order('crop_type')
      .order('moisture_pct', { ascending: false })
      .order('effective_date', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ prices: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
