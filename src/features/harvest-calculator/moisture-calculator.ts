// ─────────────────────────────────────────────────────────────────────────────
// moisture-calculator.ts — PR1 formula engine
//
// Pure functions only. No React, no Supabase, no side effects.
// Advisory tool — all outputs are estimates, not factory commitments.
// ─────────────────────────────────────────────────────────────────────────────

export type CalcInputs = {
  moisture_current : number   // M₁ — current moisture %
  moisture_target  : number   // M₂ — target moisture %
  weight_kg        : number   // W₁ — current weight kg
  price_current    : number   // P₁ — baht/kg at M₁
  price_target     : number   // P₂ — baht/kg at M₂
  drying_cost      : number   // C_dry — baht, 0 if none
};

export type CalcResult = {
  weight_after_kg  : number   // W₂ = W₁ × (100−M₁) / (100−M₂)
  weight_loss_kg   : number   // W₁ − W₂
  value_now_baht   : number   // W₁ × P₁
  value_after_baht : number   // W₂ × P₂ − C_dry
  delta_baht       : number   // value_after − value_now
  delta_per_tonne  : number   // Δ scaled to per-tonne for threshold
  verdict          : 'worth_it' | 'similar' | 'not_worth_it'
};

export type CalcFieldKey = keyof Omit<CalcInputs, never>;
export type CalcErrors   = Partial<Record<CalcFieldKey, string>>;

// ── Verdict threshold (baht per tonne) ───────────────────────────────────────
// > +500  → worth_it
// −500 to +500 → similar
// < −500  → not_worth_it
const VERDICT_THRESHOLD_PER_TONNE = 500;

// ── Core formula ─────────────────────────────────────────────────────────────
export function calculateMoistureVsBaht(i: CalcInputs): CalcResult {
  const weight_after_kg  = i.weight_kg * (100 - i.moisture_current) / (100 - i.moisture_target);
  const weight_loss_kg   = i.weight_kg - weight_after_kg;
  const value_now_baht   = i.weight_kg * i.price_current;
  const value_after_baht = weight_after_kg * i.price_target - i.drying_cost;
  const delta_baht       = value_after_baht - value_now_baht;
  const delta_per_tonne  = i.weight_kg > 0 ? (delta_baht / i.weight_kg) * 1000 : 0;

  const verdict: CalcResult['verdict'] =
    delta_per_tonne >  VERDICT_THRESHOLD_PER_TONNE ? 'worth_it'     :
    delta_per_tonne < -VERDICT_THRESHOLD_PER_TONNE ? 'not_worth_it' : 'similar';

  return { weight_after_kg, weight_loss_kg, value_now_baht, value_after_baht, delta_baht, delta_per_tonne, verdict };
}

// ── Validation ───────────────────────────────────────────────────────────────
export function validateCalcInputs(raw: Record<string, string>): CalcErrors {
  const errors: CalcErrors = {};

  const required: CalcFieldKey[] = ['moisture_current','moisture_target','weight_kg','price_current','price_target'];
  for (const f of required) {
    if (raw[f] === '' || raw[f] === undefined) {
      errors[f] = 'กรุณากรอกข้อมูล';
    }
  }

  const mc = Number(raw.moisture_current);
  const mt = Number(raw.moisture_target);

  if (!errors.moisture_current && (mc < 1 || mc > 50))
    errors.moisture_current = 'ความชื้นต้องอยู่ระหว่าง 1–50%';
  if (!errors.moisture_target && (mt < 1 || mt > 50))
    errors.moisture_target = 'ความชื้นต้องอยู่ระหว่าง 1–50%';
  if (!errors.moisture_current && !errors.moisture_target && mt >= mc)
    errors.moisture_target = 'ความชื้นเป้าหมายต้องน้อยกว่าความชื้นปัจจุบัน';

  if (!errors.weight_kg && Number(raw.weight_kg) <= 0)
    errors.weight_kg = 'น้ำหนักต้องมากกว่า 0';
  if (!errors.price_current && Number(raw.price_current) <= 0)
    errors.price_current = 'ราคาต้องมากกว่า 0';
  if (!errors.price_target && Number(raw.price_target) <= 0)
    errors.price_target = 'ราคาต้องมากกว่า 0';
  if (raw.drying_cost !== '' && raw.drying_cost !== undefined && Number(raw.drying_cost) < 0)
    errors.drying_cost = 'ค่าอบต้องไม่ติดลบ';

  return errors;
}

// ── Parse raw string inputs → CalcInputs ─────────────────────────────────────
export function parseCalcInputs(raw: Record<string, string>): CalcInputs {
  return {
    moisture_current : Number(raw.moisture_current),
    moisture_target  : Number(raw.moisture_target),
    weight_kg        : Number(raw.weight_kg),
    price_current    : Number(raw.price_current),
    price_target     : Number(raw.price_target),
    drying_cost      : raw.drying_cost === '' ? 0 : Number(raw.drying_cost),
  };
}
