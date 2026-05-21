'use client';

import type { CalcErrors } from './moisture-calculator';

export type RawInputs = {
  moisture_current : string
  moisture_target  : string
  weight_kg        : string
  price_current    : string
  price_target     : string
  drying_cost      : string
};

export const EMPTY_INPUTS: RawInputs = {
  moisture_current : '',
  moisture_target  : '14',
  weight_kg        : '',
  price_current    : '',
  price_target     : '',
  drying_cost      : '0',
};

type FieldConfig = {
  key      : keyof RawInputs
  label    : string
  hint     : string
  required : boolean
  step     : string
};

const FIELDS: FieldConfig[] = [
  { key: 'moisture_current', label: 'ความชื้นปัจจุบัน (%)',            hint: 'เช่น 28 — วัดจากเครื่องวัดความชื้น', required: true,  step: '0.1' },
  { key: 'moisture_target',  label: 'ความชื้นเป้าหมาย (%)',            hint: 'ค่ามาตรฐานโรงงาน เช่น 14',           required: true,  step: '0.1' },
  { key: 'weight_kg',        label: 'น้ำหนักโดยประมาณ (กก.)',          hint: 'เช่น 5,000',                          required: true,  step: '1'   },
  { key: 'price_current',    label: 'ราคา ณ ความชื้นปัจจุบัน (บาท/กก.)', hint: 'ราคาที่คาดว่าจะได้ตอนนี้',         required: true,  step: '0.01' },
  { key: 'price_target',     label: 'ราคา ณ ความชื้นเป้าหมาย (บาท/กก.)', hint: 'ราคาที่คาดว่าจะได้หลังแห้ง',       required: true,  step: '0.01' },
  { key: 'drying_cost',      label: 'ค่าอบหรือหักลดโดยประมาณ (บาท)',   hint: 'ใส่ 0 ถ้าไม่มีค่าใช้จ่ายเพิ่ม',      required: false, step: '1'   },
];

type Props = {
  values   : RawInputs
  onChange : (field: keyof RawInputs, value: string) => void
  errors   : CalcErrors
  compact? : boolean
}

export function CalculatorInputs({ values, onChange, errors, compact = false }: Props) {
  const gridStyle = compact
    ? { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px 16px' }
    : { display: 'flex', flexDirection: 'column' as const, gap: 12 };

  return (
    <div style={gridStyle}>
      {FIELDS.map(({ key, label, hint, required, step }) => {
        const err = errors[key];
        const labelText = compact
          ? label.replace('ความชื้นปัจจุบัน','Current M₁').replace('ความชื้นเป้าหมาย','Target M₂')
            .replace('น้ำหนักโดยประมาณ','Weight (kg)').replace('ราคา ณ ความชื้นปัจจุบัน','Price now (฿/kg)')
            .replace('ราคา ณ ความชื้นเป้าหมาย','Price after (฿/kg)').replace('ค่าอบหรือหักลดโดยประมาณ','Drying cost (฿)')
          : label;

        return (
          <label key={key} className="reg-label">
            <span>
              {labelText}
              {required && <span className="reg-required"> ✱</span>}
            </span>
            <input
              className={`reg-input${err ? ' reg-input--error' : ''}`}
              type="number"
              inputMode="decimal"
              step={step}
              min="0"
              placeholder={hint}
              value={values[key]}
              style={err ? { borderColor: '#c62828' } : undefined}
              onChange={(e) => onChange(key, e.target.value)}
            />
            {err
              ? <span style={{ fontSize: 12, color: '#c62828' }}>{err}</span>
              : <span className="reg-hint">{hint}</span>
            }
          </label>
        );
      })}
    </div>
  );
}
