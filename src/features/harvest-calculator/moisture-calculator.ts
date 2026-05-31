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
  // Curve อ้างอิงพันธุ์แปซิฟิค 339 (ข้าวโพดเลี้ยงสัตว์ไร่ อายุเก็บ 105-120 วัน)
  // D≤60  = ~38% (ก่อนออกดอก)
  // D100  = 35-38% (แป้งแข็ง)
  // D105  = 30-33% (สุกแก่สรีรวิทยา Black Layer)
  // D110  = 25-28%
  // D115  = 18-20%
  // D120+ = 14.5%
  if (daysSincePlanted <= 60)  return 38;
  if (daysSincePlanted >= 120) return 14.5;

  const curve = [
    { day: 60,  pct: 38 },
    { day: 100, pct: 36.5 },  // midpoint 35-38%
    { day: 105, pct: 31.5 },  // midpoint 30-33%
    { day: 110, pct: 26.5 },  // midpoint 25-28%
    { day: 115, pct: 19.0 },  // midpoint 15-20% (หักแห้ง)
    { day: 120, pct: 14.5 },  // mature
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
  // อ้างอิงแปซิฟิค 339 — ออกดอก D53, เก็บเกี่ยว D105-120
  if (daysSincePlanted < 7)   return { label: 'งอก',               icon: '🌱', color: '#6b7280' };
  if (daysSincePlanted < 20)  return { label: 'ตั้งต้น (V3-V5)',   icon: '🌿', color: '#2e7d32' };
  if (daysSincePlanted < 40)  return { label: 'เจริญเติบโต (V6+)', icon: '🌾', color: '#2e7d32' };
  if (daysSincePlanted < 53)  return { label: 'เตรียมออกดอก',      icon: '⚠️', color: '#e65100' }; // ระวัง: ปุ๋ยรอบ2 + น้ำ
  if (daysSincePlanted < 65)  return { label: 'ออกดอก/ผสมเกสร',    icon: '🌸', color: '#7b1fa2' }; // วิกฤต: ห้ามขาดน้ำ
  if (daysSincePlanted < 80)  return { label: 'ติดเมล็ด/ฝักพัฒนา', icon: '🌽', color: '#e65100' };
  if (daysSincePlanted < 100) return { label: 'เมล็ดสะสมแป้ง',     icon: '🌽', color: '#e65100' };
  if (daysSincePlanted < 105) return { label: 'แป้งแข็ง (~36%ชื้น)',icon: '⏳', color: '#c62828' };
  if (daysSincePlanted < 110) return { label: 'Black Layer (พร้อมหัก)', icon: '✅', color: '#2e7d32' };
  if (daysSincePlanted < 120) return { label: 'หักแห้ง (~20%ชื้น)', icon: '✅', color: '#1565c0' };
  return { label: 'แห้งสนิท เก็บเกี่ยวได้', icon: '🚜', color: '#1b5e20' };
}
