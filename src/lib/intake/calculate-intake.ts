// src/lib/intake/calculate-intake.ts
// Z3-2: Shared calculation engine — ใช้ร่วมกันทั้ง factory API, manual entry, CSV import
// Pure async function — รับ SupabaseClient เพื่อ query ข้อมูล ไม่มี side effects อื่น

import type { SupabaseClient } from '@supabase/supabase-js';
import { isPromoApplicable } from '@/features/harvest-calculator/moisture-calculator';

// ── Types ────────────────────────────────────────────────────────────────────

export type IntakeInput = {
  gross_weight_kg : number
  moisture_pct    : number
  member_id       : string
  location_id     : string
  weigh_at        : Date
  crop_type?      : string   // default 'ข้าวโพด'
};

export type IntakeResultPromo = {
  id             : string
  title          : string
  promo_bonus_per_kg : number
  applied        : boolean
};

export type IntakeResult = {
  // น้ำหนัก
  gross_weight_kg  : number
  deduct_pct       : number
  deduct_kg        : number
  net_weight_kg    : number
  // ราคา
  base_price       : number
  price_adjust     : number   // บวกตามความชื้น
  total_bonus      : number   // รวมโปรโมชั่น
  final_price      : number   // ราคาสุดท้าย/กก.
  // ยอดเงิน
  gross_amount     : number   // net_weight × base_price
  bonus_amount     : number   // net_weight × total_bonus
  net_amount       : number   // net_weight × final_price
  // รายละเอียด
  applied_promos   : IntakeResultPromo[]
  deduction_note   : string | null
};

type DeductionRow = {
  moisture_pct        : number
  weight_deduct_pct   : number
  price_adjust_per_kg : number
  note                : string | null
};

type PromoRow = {
  id                 : string
  title              : string
  promo_type         : 'flat' | 'moisture_below'
  promo_bonus_per_kg : number
  moisture_threshold : number | null
};

// ── Main function ─────────────────────────────────────────────────────────────

export async function calculateIntake(
  input   : IntakeInput,
  supabase : SupabaseClient,
): Promise<IntakeResult> {
  const crop = input.crop_type ?? 'ข้าวโพด';
  const today = input.weigh_at.toISOString().slice(0, 10);

  // ── 1. ดึงข้อมูลพร้อมกัน ──────────────────────────────────────────────────
  const [deductRes, priceRes, promoRes] = await Promise.all([
    supabase
      .from('moisture_deductions')
      .select('moisture_pct,weight_deduct_pct,price_adjust_per_kg,note')
      .eq('crop_type', crop)
      .eq('is_active', true),

    supabase
      .from('market_prices')
      .select('price_per_kg')
      .eq('crop_type', crop)
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('campaign_announcements')
      .select('id,title,promo_type,promo_bonus_per_kg,moisture_threshold')
      .not('promo_type', 'is', null)
      .eq('is_active', true)
      .lte('start_date', today)
      .gte('end_date', today),
  ]);

  const deductions  = (deductRes.data ?? []) as DeductionRow[];
  const base_price  = Number(priceRes.data?.price_per_kg ?? 0);
  const promos      = (promoRes.data ?? []) as PromoRow[];

  // ── 2. หา deduction ที่ใกล้เคียงความชื้นที่สุด ─────────────────────────────
  const d = deductions.length > 0
    ? [...deductions].sort((a, b) =>
        Math.abs(a.moisture_pct - input.moisture_pct) - Math.abs(b.moisture_pct - input.moisture_pct)
      )[0]!
    : { moisture_pct: input.moisture_pct, weight_deduct_pct: 0, price_adjust_per_kg: 0, note: null };

  // ── 3. คำนวณน้ำหนัก ────────────────────────────────────────────────────────
  const deduct_pct    = d.weight_deduct_pct;
  const deduct_kg     = input.gross_weight_kg * (deduct_pct / 100);
  const net_weight_kg = input.gross_weight_kg - deduct_kg;

  // ── 4. คำนวณราคา ─────────────────────────────────────────────────────────────
  const price_adjust = d.price_adjust_per_kg;

  const applied_promos: IntakeResultPromo[] = promos.map((p) => ({
    id:                p.id,
    title:             p.title,
    promo_bonus_per_kg:Number(p.promo_bonus_per_kg),
    applied:           isPromoApplicable(
      { ...p, promo_bonus_per_kg: Number(p.promo_bonus_per_kg), end_date: "" },
      input.moisture_pct
    ),
  }));

  const total_bonus = applied_promos
    .filter((p) => p.applied)
    .reduce((sum, p) => sum + p.promo_bonus_per_kg, 0);

  const final_price = base_price + price_adjust + total_bonus;

  // ── 5. คำนวณยอดเงิน ───────────────────────────────────────────────────────
  const gross_amount = net_weight_kg * base_price;
  const bonus_amount = net_weight_kg * total_bonus;
  const net_amount   = net_weight_kg * final_price;

  return {
    gross_weight_kg: input.gross_weight_kg,
    deduct_pct, deduct_kg, net_weight_kg,
    base_price, price_adjust, total_bonus, final_price,
    gross_amount, bonus_amount, net_amount,
    applied_promos,
    deduction_note: d.note,
  };
}
