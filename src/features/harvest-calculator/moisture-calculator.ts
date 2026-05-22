// ─────────────────────────────────────────────────────────────────────────────
// moisture-calculator.ts
// เปรียบเทียบ: ขายที่ความชื้นสูง (ราคาถูก น้ำหนักมาก)
//           vs รอให้ความชื้นลด (ราคาดีขึ้น แต่น้ำหนักหายไป)
// Pure functions only — no React, no Supabase, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

export type CalcInputs = {
  moisture_current : number   // M₁ — ความชื้นปัจจุบัน %
  moisture_target  : number   // M₂ — ความชื้นที่จะเปรียบเทียบ %
  weight_kg        : number   // W₁ — น้ำหนักปัจจุบัน กก.
  price_current    : number   // P₁ — ราคา ณ ความชื้น M₁ (บาท/กก.)
  price_target     : number   // P₂ — ราคา ณ ความชื้น M₂ (บาท/กก.)
};

export type CalcResult = {
  weight_after_kg        : number   // W₂ = W₁ × (100−M₁) / (100−M₂)
  weight_loss_kg         : number   // น้ำหนักที่หายไป = W₁ − W₂
  value_now_baht         : number   // รายได้ถ้าขายเลย = W₁ × P₁
  value_after_baht       : number   // รายได้ถ้ารอขาย = W₂ × P₂
  delta_baht             : number   // ผลต่างรายได้ = value_after − value_now
  delta_per_tonne        : number   // ผลต่างต่อตัน (ใช้ตัดสิน verdict)
  baht_lost_from_weight  : number   // มูลค่าที่เสียจากน้ำหนักหาย = weight_loss × P₁
  baht_gained_from_price : number   // มูลค่าที่ได้จากราคาดีขึ้น = (P₂−P₁) × W₂
  verdict                : 'worth_it' | 'similar' | 'not_worth_it'
};

export type CalcFieldKey = keyof CalcInputs;
export type CalcErrors   = Partial<Record<CalcFieldKey, string>>;

// threshold ±300 บาท/ตัน — ผลต่างน้อยกว่านี้ถือว่าใกล้เคียงกัน
const THRESHOLD = 300;

// ── Core formula ──────────────────────────────────────────────────────────────
export function calculateMoistureVsBaht(i: CalcInputs): CalcResult {
  const weight_after_kg        = i.weight_kg * (100 - i.moisture_current) / (100 - i.moisture_target);
  const weight_loss_kg         = i.weight_kg - weight_after_kg;
  const value_now_baht         = i.weight_kg * i.price_current;
  const value_after_baht       = weight_after_kg * i.price_target;
  const delta_baht             = value_after_baht - value_now_baht;
  const delta_per_tonne        = i.weight_kg > 0 ? (delta_baht / i.weight_kg) * 1000 : 0;
  const baht_lost_from_weight  = weight_loss_kg * i.price_current;
  const baht_gained_from_price = (i.price_target - i.price_current) * weight_after_kg;

  const verdict: CalcResult['verdict'] =
    delta_per_tonne >  THRESHOLD ? 'worth_it'     :
    delta_per_tonne < -THRESHOLD ? 'not_worth_it' : 'similar';

  return { weight_after_kg, weight_loss_kg, value_now_baht, value_after_baht,
           delta_baht, delta_per_tonne, baht_lost_from_weight, baht_gained_from_price, verdict };
}

// ── Validation ────────────────────────────────────────────────────────────────
export function validateCalcInputs(raw: Record<string, string>): CalcErrors {
  const errors: CalcErrors = {};
  const required: CalcFieldKey[] = ['moisture_current','moisture_target','weight_kg','price_current','price_target'];

  for (const f of required) {
    if (raw[f] === '' || raw[f] === undefined) { errors[f] = 'กรุณากรอกข้อมูล'; continue; }
    if (Number(raw[f]) <= 0 && f !== 'moisture_current' && f !== 'moisture_target')
      errors[f] = 'ต้องมากกว่า 0';
  }

  const mc = Number(raw.moisture_current), mt = Number(raw.moisture_target);
  if (!errors.moisture_current && (mc < 1 || mc > 50)) errors.moisture_current = 'ความชื้นต้องอยู่ระหว่าง 1–50%';
  if (!errors.moisture_target  && (mt < 1 || mt > 50)) errors.moisture_target  = 'ความชื้นต้องอยู่ระหว่าง 1–50%';
  if (!errors.moisture_current && !errors.moisture_target && mt >= mc)
    errors.moisture_target = 'ความชื้นเปรียบเทียบต้องน้อยกว่าความชื้นปัจจุบัน';

  return errors;
}

// ── Parse raw strings → CalcInputs ───────────────────────────────────────────
export function parseCalcInputs(raw: Record<string, string>): CalcInputs {
  return {
    moisture_current : Number(raw.moisture_current),
    moisture_target  : Number(raw.moisture_target),
    weight_kg        : Number(raw.weight_kg),
    price_current    : Number(raw.price_current),
    price_target     : Number(raw.price_target),
  };
}
