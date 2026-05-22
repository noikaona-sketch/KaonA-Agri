// moisture-calculator.ts — formula engine v2
// Base price = ราคาเปียก 30% เสมอ
// Deduction table: หัก %น้ำหนัก + หักบาท/กก. ตามความชื้น

export type Deduction = {
  moisture_pct        : number
  weight_deduct_pct   : number   // % หักน้ำหนัก เช่น 5 = หัก 5%
  price_deduct_per_kg : number   // บาท/กก. ที่หักออก
  drying_days_per_pct : number   // วันที่ใช้ลดความชื้น 1%
  note                : string | null
};

export type CalcResult = {
  moisture_pct        : number
  weight_input_kg     : number   // น้ำหนักที่กรอก
  weight_deducted_kg  : number   // น้ำหนักหลังหัก %
  weight_loss_kg      : number   // น้ำหนักที่หักออก
  base_price_per_kg   : number   // ราคาฐาน (เปียก 30%)
  price_after_deduct  : number   // ราคา/กก. หลังหักบาท
  revenue_baht        : number   // รายได้จริง
  weight_deduct_pct   : number
  price_deduct_per_kg : number
};

export type TimingResult = {
  days              : number
  expected_moisture : number   // ความชื้นคาดการณ์หลัง N วัน
  deduction         : Deduction | null
  revenue_baht      : number | null
  rain_risk         : 'low' | 'medium' | 'high'
  rain_prob_max     : number   // % โอกาสฝน
};

// ── คำนวณรายได้จากความชื้นที่เลือก ─────────────────────────────────────────
export function calcRevenue(
  moisture_pct  : number,
  weight_kg     : number,
  base_price    : number,
  deductions    : Deduction[],
): CalcResult {
  const d = deductions.find((r) => r.moisture_pct === moisture_pct) ?? {
    moisture_pct, weight_deduct_pct: 0, price_deduct_per_kg: 0, drying_days_per_pct: 1, note: null,
  };
  const weight_deducted_kg = weight_kg * (1 - d.weight_deduct_pct / 100);
  const weight_loss_kg     = weight_kg - weight_deducted_kg;
  const price_after_deduct = Math.max(0, base_price - d.price_deduct_per_kg);
  const revenue_baht       = weight_deducted_kg * price_after_deduct;
  return { moisture_pct, weight_input_kg: weight_kg, weight_deducted_kg, weight_loss_kg,
           base_price_per_kg: base_price, price_after_deduct, revenue_baht,
           weight_deduct_pct: d.weight_deduct_pct, price_deduct_per_kg: d.price_deduct_per_kg };
}

// ── คาดการณ์ความชื้นหลัง N วัน ───────────────────────────────────────────────
export function estimateMoistureAfterDays(
  current_moisture : number,
  days             : number,
  deductions       : Deduction[],
): number {
  // drying_days_per_pct ของแถวที่ใกล้เคียงที่สุด
  const sorted = [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - current_moisture) - Math.abs(b.moisture_pct - current_moisture)
  );
  const rate = sorted[0]?.drying_days_per_pct ?? 1; // วัน/1%
  const drop = days / rate;
  return Math.max(14.5, current_moisture - drop);   // ไม่ต่ำกว่า 14.5%
}

// ── หาแถวส่วนลดที่ใกล้เคียงที่สุด ────────────────────────────────────────────
export function nearestDeduction(moisture: number, deductions: Deduction[]): Deduction | null {
  if (!deductions.length) return null;
  return [...deductions].sort((a, b) =>
    Math.abs(a.moisture_pct - moisture) - Math.abs(b.moisture_pct - moisture)
  )[0] ?? null;
}

// ── rain risk label ───────────────────────────────────────────────────────────
export function rainRisk(prob: number): 'low' | 'medium' | 'high' {
  return prob >= 60 ? 'high' : prob >= 30 ? 'medium' : 'low';
}
