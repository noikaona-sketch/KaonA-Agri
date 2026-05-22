'use client';

import type { CalcErrors } from './moisture-calculator';

export type RawInputs = {
  moisture_current : string
  moisture_target  : string
  weight_kg        : string
  price_current    : string
  price_target     : string
};

export const EMPTY_INPUTS: RawInputs = {
  moisture_current : '',
  moisture_target  : '',
  weight_kg        : '',
  price_current    : '',
  price_target     : '',
};

type FieldDef = { key: keyof RawInputs; label: string; labelCompact: string; hint: string; step: string };

const FIELDS: FieldDef[] = [
  { key: 'moisture_current', label: 'ความชื้นปัจจุบัน (%)',           labelCompact: 'ความชื้นตอนนี้ (%)',      hint: 'เช่น 28',  step: '0.1'  },
  { key: 'moisture_target',  label: 'ความชื้นที่จะเปรียบเทียบ (%)',   labelCompact: 'ความชื้นที่จะเทียบ (%)', hint: 'เช่น 22',  step: '0.1'  },
  { key: 'weight_kg',        label: 'น้ำหนักปัจจุบัน (กก.)',           labelCompact: 'น้ำหนัก (กก.)',           hint: 'เช่น 5,000', step: '1'  },
  { key: 'price_current',    label: 'ราคา ณ ความชื้นปัจจุบัน (บาท/กก.)', labelCompact: 'ราคาตอนนี้ (฿/กก.)',  hint: 'เช่น 4.20', step: '0.01' },
  { key: 'price_target',     label: 'ราคา ณ ความชื้นที่จะเปรียบเทียบ (บาท/กก.)', labelCompact: 'ราคาเทียบ (฿/กก.)', hint: 'เช่น 4.60', step: '0.01' },
];

type Props = {
  values   : RawInputs
  onChange : (field: keyof RawInputs, value: string) => void
  errors   : CalcErrors
  compact? : boolean
}

export function CalculatorInputs({ values, onChange, errors, compact = false }: Props) {
  return (
    <div style={compact
      ? { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px 16px' }
      : { display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FIELDS.map(({ key, label, labelCompact, hint, step }) => {
        const err = errors[key];
        return (
          <label key={key} className="reg-label">
            <span>{compact ? labelCompact : label}<span className="reg-required"> ✱</span></span>
            <input
              className="reg-input"
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
              : <span className="reg-hint">{hint}</span>}
          </label>
        );
      })}
    </div>
  );
}
