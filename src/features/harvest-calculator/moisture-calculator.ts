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

// ── คาดการณ์ความชื้นหลัง N วัน (ปรับตามฝน) ─────────────────────────────────
export function estimateMoistureAfterDays(
  current_moisture : number, days: number, deductions: Deduction[],
  rain_prob_max    : number = 0,  // % โอกาสฝนสูงสุด — ฝนหนักแห้งช้าลง
): number {
  const sorted = [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - current_moisture) - Math.abs(b.moisture_pct - current_moisture)
  );
  const baseRate     = sorted[0]?.drying_days_per_pct ?? 1;
  const adjustedRate = rain_prob_max >= 60 ? baseRate * 2
                     : rain_prob_max >= 30 ? baseRate * 1.5
                     : baseRate;
  return Math.max(14.5, current_moisture - days / adjustedRate);
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

// ─────────────────────────────────────────────────────────────────────────────
// อายุข้าวโพด → ความชื้นโดยประมาณ
// อ้างอิงข้อมูลภาคสนามพันธุ์ไร่ (อายุเก็บเกี่ยว 90-110 วัน)
// ─────────────────────────────────────────────────────────────────────────────
export function estimateMoistureByAge(daysSincePlanted: number): number {
  // Curve: moisture ลดลงแบบ linear หลังวันที่ 60
  // D60  = ~35% (ออกดอก)
  // D75  = ~30%
  // D85  = ~26%
  // D90  = ~23%
  // D100 = ~18%
  // D110 = ~14.5% (mature)
  if (daysSincePlanted <= 60)  return 35;
  if (daysSincePlanted >= 110) return 14.5;

  // Linear interpolation between key points
  const curve = [
    { day: 60,  pct: 35 },
    { day: 75,  pct: 30 },
    { day: 85,  pct: 26 },
    { day: 90,  pct: 23 },
    { day: 100, pct: 18 },
    { day: 110, pct: 14.5 },
  ];

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (daysSincePlanted >= a.day && daysSincePlanted <= b.day) {
      const t = (daysSincePlanted - a.day) / (b.day - a.day);
      return Math.round((a.pct + t * (b.pct - a.pct)) * 10) / 10;
    }
  }
  return 14.5;
}

// แปลงอายุเป็น label ขั้นการเจริญเติบโต
export function growthStageLabel(daysSincePlanted: number): { label: string; icon: string; color: string } {
  if (daysSincePlanted < 10)  return { label: 'งอก',           icon: '🌱', color: '#6b7280' };
  if (daysSincePlanted < 30)  return { label: 'ตั้งต้น',       icon: '🌿', color: '#2e7d32' };
  if (daysSincePlanted < 45)  return { label: 'เจริญเติบโต',   icon: '🌾', color: '#2e7d32' };
  if (daysSincePlanted < 55)  return { label: 'ออกดอก',        icon: '🌸', color: '#7b1fa2' };
  if (daysSincePlanted < 70)  return { label: 'ติดฝัก',        icon: '🌽', color: '#e65100' };
  if (daysSincePlanted < 85)  return { label: 'ฝักพัฒนา',      icon: '🌽', color: '#e65100' };
  if (daysSincePlanted < 95)  return { label: 'ใกล้แก่',       icon: '⏳', color: '#c62828' };
  if (daysSincePlanted < 105) return { label: 'แก่จัด พร้อมเก็บ', icon: '✅', color: '#c62828' };
  return { label: 'สุกเกินไป', icon: '⚠️', color: '#9e9e9e' };
}
