import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/moisture-deductions?crop_type=ข้าวโพด&lat=15.0&lng=101.0&days=3
export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const cropType = url.searchParams.get('crop_type') ?? 'ข้าวโพด';
    const lat      = url.searchParams.get('lat');
    const lng      = url.searchParams.get('lng');
    const days     = Number(url.searchParams.get('days') ?? 7);
    const s        = createServerSupabaseClient();
    const today    = new Date().toISOString().slice(0, 10);

    const [deductRes, priceRes, promoRes] = await Promise.all([
      // ตารางส่วนลดตามความชื้น
      s.from('moisture_deductions')
        .select('moisture_pct,weight_deduct_pct,price_adjust_per_kg,drying_days_per_pct,note')
        .eq('crop_type', cropType).eq('is_active', true)
        .order('moisture_pct', { ascending: false }),

      // ราคาฐานเปียก
      s.from('market_prices')
        .select('price_per_kg')
        .eq('crop_type', cropType).eq('is_active', true)
        .order('moisture_pct', { ascending: false })
        .limit(1).maybeSingle(),

      // โปรโมชั่นที่ active ทั้งหมด
      s.from('campaign_announcements')
        .select('id,title,promo_type,promo_bonus_per_kg,moisture_threshold,end_date')
        .not('promo_type', 'is', null)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date',   today),
    ]);

    // Weather (Open-Meteo — ฟรี ไม่ต้อง API key)
    let weather: { date: string; rain_prob: number; rain_mm: number }[] = [];
    if (lat && lng) {
      try {
        const wUrl  = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
          + `&daily=precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok&forecast_days=${Math.min(days + 1, 7)}`;
        const wData = await (await fetch(wUrl, { next: { revalidate: 3600 } })).json() as {
          daily?: { time: string[]; precipitation_probability_max: number[]; precipitation_sum: number[] }
        };
        if (wData.daily) {
          weather = wData.daily.time.slice(1, days + 1).map((d, i) => ({
            date: d, rain_prob: wData.daily!.precipitation_probability_max[i + 1] ?? 0,
            rain_mm: wData.daily!.precipitation_sum[i + 1] ?? 0,
          }));
        }
      } catch { /* fail silently */ }
    }

    return NextResponse.json({
      deductions:        deductRes.data ?? [],
      base_price_per_kg: priceRes.data?.price_per_kg ?? null,
      promos:            promoRes.data ?? [],
      weather,
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
