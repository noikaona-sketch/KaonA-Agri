// moisture-calculator.ts — formula engine v3
// Base price = ราคาเปียก 30% เสมอ
// ราคาสุดท้าย = ราคาฐาน + บวกตามความชื้น + โบนัสสมาชิก (ถ้ามี)

export type Deduction = {
  moisture_pct        : number
  weight_deduct_pct   : number   // % หักน้ำหนัก เช่น 5 = หัก 5%
  price_adjust_per_kg : number   // บวกเพิ่มจากราคาฐาน (ยิ่งแห้งยิ่งบวกมาก)
  drying_days_per_pct : number   // วันที่ใช้ลดความชื้น 1%
  note                : string | null
};

export type CalcResult = {
  moisture_pct        : number
  weight_input_kg     : number
  weight_deducted_kg  : number   // น้ำหนักหลังหัก %
  weight_loss_kg      : number   // น้ำหนักที่หักออก
  base_price_per_kg   : number   // ราคาฐาน (เปียก 30%)
  price_after_adjust  : number   // ราคาฐาน + บวกตามความชื้น
  member_bonus_per_kg : number   // โบนัสโปรโมชั่นสมาชิก
  final_price_per_kg  : number   // ราคาสุดท้าย = price_after_adjust + bonus
  revenue_baht        : number   // รายได้จริง
  weight_deduct_pct   : number
  price_adjust_per_kg : number
};

export type TimingResult = {
  days              : number
  expected_moisture : number
  deduction         : Deduction | null
  revenue_baht      : number | null
  rain_risk         : 'low' | 'medium' | 'high'
  rain_prob_max     : number
};

// ── คำนวณรายได้ ───────────────────────────────────────────────────────────────
export function calcRevenue(
  moisture_pct  : number,
  weight_kg     : number,
  base_price    : number,
  deductions    : Deduction[],
  member_bonus  : number = 0,
): CalcResult {
  const d = deductions.find((r) => r.moisture_pct === moisture_pct) ?? {
    moisture_pct, weight_deduct_pct: 0, price_adjust_per_kg: 0, drying_days_per_pct: 1, note: null,
  };
  const weight_deducted_kg = weight_kg * (1 - d.weight_deduct_pct / 100);
  const weight_loss_kg     = weight_kg - weight_deducted_kg;
  const price_after_adjust = base_price + d.price_adjust_per_kg;
  const final_price_per_kg = price_after_adjust + member_bonus;
  const revenue_baht       = weight_deducted_kg * final_price_per_kg;
  return {
    moisture_pct, weight_input_kg: weight_kg, weight_deducted_kg, weight_loss_kg,
    base_price_per_kg: base_price, price_after_adjust,
    member_bonus_per_kg: member_bonus, final_price_per_kg, revenue_baht,
    weight_deduct_pct: d.weight_deduct_pct, price_adjust_per_kg: d.price_adjust_per_kg,
  };
}

// ── คาดการณ์ความชื้นหลัง N วัน ───────────────────────────────────────────────
export function estimateMoistureAfterDays(
  current_moisture : number,
  days             : number,
  deductions       : Deduction[],
): number {
  const sorted = [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - current_moisture) - Math.abs(b.moisture_pct - current_moisture)
  );
  const rate = sorted[0]?.drying_days_per_pct ?? 1;
  return Math.max(14.5, current_moisture - days / rate);
}

// ── หาแถวใกล้เคียงที่สุด ──────────────────────────────────────────────────────
export function nearestDeduction(moisture: number, deductions: Deduction[]): Deduction | null {
  if (!deductions.length) return null;
  return [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - moisture) - Math.abs(b.moisture_pct - moisture)
  )[0] ?? null;
}

// ── rain risk ─────────────────────────────────────────────────────────────────
export function rainRisk(prob: number): 'low' | 'medium' | 'high' {
  return prob >= 60 ? 'high' : prob >= 30 ? 'medium' : 'low';
}
