import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/moisture-deductions?crop_type=ข้าวโพด&lat=15.0&lng=101.0&days=3
// ดึงตารางส่วนลด + weather forecast (Open-Meteo) สำหรับ farmer
export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const cropType = url.searchParams.get('crop_type') ?? 'ข้าวโพด';
    const lat      = url.searchParams.get('lat');
    const lng      = url.searchParams.get('lng');
    const days     = Number(url.searchParams.get('days') ?? 3);

    const s = createServerSupabaseClient();

    // ── ตารางส่วนลด ────────────────────────────────────────────────────
    const { data: rows, error } = await s
      .from('moisture_deductions')
      .select('moisture_pct,weight_deduct_pct,price_adjust_per_kg,drying_days_per_pct,note')
      .eq('crop_type', cropType)
      .eq('is_active', true)
      .order('moisture_pct', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── ราคาฐานเปียก (moisture_pct = 30) ──────────────────────────────
    const { data: basePrice } = await s
      .from('market_prices')
      .select('price_per_kg')
      .eq('crop_type', cropType)
      .eq('is_active', true)
      .order('moisture_pct', { ascending: false })
      .limit(1)
      .single();

    // ── Weather (Open-Meteo — ฟรี ไม่ต้อง API key) ────────────────────
    let weather: { date: string; rain_prob: number; rain_mm: number }[] = [];
    if (lat && lng) {
      const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
        + `&daily=precipitation_probability_max,precipitation_sum`
        + `&timezone=Asia%2FBangkok&forecast_days=${Math.min(days + 1, 7)}`;
      try {
        const wRes  = await fetch(wUrl, { next: { revalidate: 3600 } });
        const wData = await wRes.json() as {
          daily?: { time: string[]; precipitation_probability_max: number[]; precipitation_sum: number[] }
        };
        if (wData.daily) {
          weather = wData.daily.time.slice(1, days + 1).map((d, i) => ({
            date:      d,
            rain_prob: wData.daily!.precipitation_probability_max[i + 1] ?? 0,
            rain_mm:   wData.daily!.precipitation_sum[i + 1] ?? 0,
          }));
        }
      } catch { /* weather เป็น optional — fail silently */ }
    }

    return NextResponse.json({
      deductions:     rows ?? [],
      base_price_per_kg: basePrice?.price_per_kg ?? null,
      weather,
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
