// moisture-calculator.ts — formula engine v4
// ราคาสุดท้าย = ราคาฐาน + บวกตามความชื้น + รวมทุกโปรที่ผ่านเงื่อนไข

export type Deduction = {
  moisture_pct        : number
  weight_deduct_pct   : number
  price_adjust_per_kg : number   // บวกจากราคาฐาน (ยิ่งแห้งยิ่งมาก)
  drying_days_per_pct : number
  note                : string | null
};

export type Promo = {
  id                 : string
  title              : string
  promo_type         : 'flat' | 'moisture_below'
  promo_bonus_per_kg : number
  moisture_threshold : number | null   // ใช้กับ moisture_below เท่านั้น
  end_date           : string
};

export type AppliedPromo = Promo & { applied: boolean };

export type CalcResult = {
  moisture_pct        : number
  weight_input_kg     : number
  weight_deducted_kg  : number
  weight_loss_kg      : number
  base_price_per_kg   : number
  price_after_adjust  : number   // ราคาฐาน + moisture adjust
  applied_promos      : AppliedPromo[]
  total_bonus_per_kg  : number   // รวมทุกโปรที่ได้
  final_price_per_kg  : number   // price_after_adjust + total_bonus
  revenue_baht        : number
  weight_deduct_pct   : number
  price_adjust_per_kg : number
};

// ── ตรวจว่า promo ผ่านเงื่อนไขสำหรับความชื้นนี้ไหม ──────────────────────────
export function isPromoApplicable(promo: Promo, moisture_pct: number): boolean {
  if (promo.promo_type === 'flat') return true;
  if (promo.promo_type === 'moisture_below' && promo.moisture_threshold != null)
    return moisture_pct < promo.moisture_threshold;
  return false;
}

// ── คำนวณรายได้ ───────────────────────────────────────────────────────────────
export function calcRevenue(
  moisture_pct : number,
  weight_kg    : number,
  base_price   : number,
  deductions   : Deduction[],
  promos       : Promo[] = [],
): CalcResult {
  const d = deductions.find((r) => r.moisture_pct === moisture_pct) ?? {
    moisture_pct, weight_deduct_pct: 0, price_adjust_per_kg: 0, drying_days_per_pct: 1, note: null,
  };

  const weight_deducted_kg = weight_kg * (1 - d.weight_deduct_pct / 100);
  const weight_loss_kg     = weight_kg - weight_deducted_kg;
  const price_after_adjust = base_price + d.price_adjust_per_kg;

  const applied_promos: AppliedPromo[] = promos.map((p) => ({
    ...p, applied: isPromoApplicable(p, moisture_pct),
  }));
  const total_bonus_per_kg = applied_promos
    .filter((p) => p.applied)
    .reduce((sum, p) => sum + p.promo_bonus_per_kg, 0);

  const final_price_per_kg = price_after_adjust + total_bonus_per_kg;
  const revenue_baht       = weight_deducted_kg * final_price_per_kg;

  return {
    moisture_pct, weight_input_kg: weight_kg, weight_deducted_kg, weight_loss_kg,
    base_price_per_kg: base_price, price_after_adjust, applied_promos,
    total_bonus_per_kg, final_price_per_kg, revenue_baht,
    weight_deduct_pct: d.weight_deduct_pct, price_adjust_per_kg: d.price_adjust_per_kg,
  };
}

// ── คาดการณ์ความชื้นหลัง N วัน ───────────────────────────────────────────────
export function estimateMoistureAfterDays(
  current_moisture : number, days: number, deductions: Deduction[],
): number {
  const sorted = [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - current_moisture) - Math.abs(b.moisture_pct - current_moisture)
  );
  const rate = sorted[0]?.drying_days_per_pct ?? 1;
  return Math.max(14.5, current_moisture - days / rate);
}

export function nearestDeduction(moisture: number, deductions: Deduction[]): Deduction | null {
  if (!deductions.length) return null;
  return [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - moisture) - Math.abs(b.moisture_pct - moisture)
  )[0] ?? null;
}

export function rainRisk(prob: number): 'low' | 'medium' | 'high' {
  return prob >= 60 ? 'high' : prob >= 30 ? 'medium' : 'low';
}
