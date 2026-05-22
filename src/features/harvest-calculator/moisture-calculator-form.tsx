'use client';

import { useRef, useState }                                              from 'react';
import { calculateMoistureVsBaht, parseCalcInputs, validateCalcInputs } from './moisture-calculator';
import type { CalcResult, CalcErrors }                                   from './moisture-calculator';
import { CalculatorInputs, EMPTY_INPUTS }                               from './calculator-inputs';
import type { RawInputs }                                               from './calculator-inputs';
import { CalculatorResult }                                              from './calculator-result';

type Props = { compact?: boolean };

export function MoistureCalculatorForm({ compact = false }: Props) {
  const [values,  setValues]  = useState<RawInputs>(EMPTY_INPUTS);
  const [errors,  setErrors]  = useState<CalcErrors>({});
  const [result,  setResult]  = useState<CalcResult | null>(null);
  const resultRef             = useRef<HTMLDivElement>(null);

  function handleChange(field: keyof RawInputs, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleCalculate() {
    const raw  = values as unknown as Record<string, string>;
    const errs = validateCalcInputs(raw);
    if (Object.keys(errs).length > 0) { setErrors(errs); setResult(null); return; }
    setErrors({});
    setResult(calculateMoistureVsBaht(parseCalcInputs(raw)));
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  function handleReset() {
    setValues(EMPTY_INPUTS);
    setErrors({});
    setResult(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="kaona-card">
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500, color: '#6b7280' }}>── ข้อมูลสำหรับคำนวณ ──</p>
        <CalculatorInputs values={values} onChange={handleChange} errors={errors} compact={compact} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="admin-btn admin-btn--primary" onClick={handleCalculate}
          style={{ flex: compact ? 'none' : 1, minHeight: compact ? 40 : 52, fontSize: compact ? 14 : 16, fontWeight: 500 }}>
          คำนวณ
        </button>
        {result && (
          <button className="admin-btn admin-btn--secondary" onClick={handleReset}
            style={{ fontSize: 13, padding: '8px 16px' }}>
            ล้างข้อมูล
          </button>
        )}
      </div>

      <div ref={resultRef}>
        {result && (
          <div className="kaona-card">
            <CalculatorResult result={result} moistureTarget={values.moisture_target} compact={compact} />
          </div>
        )}
      </div>
    </div>
  );
}
