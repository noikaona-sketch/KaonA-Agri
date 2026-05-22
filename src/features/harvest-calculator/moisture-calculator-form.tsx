'use client';

import { useEffect, useRef, useState }                                   from 'react';
import { calculateMoistureVsBaht, parseCalcInputs, validateCalcInputs } from './moisture-calculator';
import type { CalcResult, CalcErrors }                                   from './moisture-calculator';
import { CalculatorInputs, EMPTY_INPUTS }                               from './calculator-inputs';
import type { RawInputs }                                               from './calculator-inputs';
import { CalculatorResult }                                              from './calculator-result';

type PriceRow = { moisture_pct: number | null; price_per_kg: number; price_type: string };

type Props = { compact?: boolean };

export function MoistureCalculatorForm({ compact = false }: Props) {
  const [values,     setValues]     = useState<RawInputs>(EMPTY_INPUTS);
  const [errors,     setErrors]     = useState<CalcErrors>({});
  const [result,     setResult]     = useState<CalcResult | null>(null);
  const [priceTable, setPriceTable] = useState<PriceRow[]>([]);
  const resultRef                   = useRef<HTMLDivElement>(null);

  // โหลดตารางราคาจาก market_prices (active เท่านั้น)
  useEffect(() => {
    void fetch('/api/market-prices')
      .then((r) => r.json())
      .then((d: { prices?: PriceRow[] }) => {
        const rows = (d.prices ?? []).filter((p) => p.moisture_pct !== null);
        setPriceTable(rows);
      });
  }, []);

  // หาราคาที่ใกล้เคียงที่สุดสำหรับความชื้นที่กรอก
  function findPrice(moistureStr: string): string {
    if (!moistureStr || priceTable.length === 0) return '';
    const m = Number(moistureStr);
    const sorted = [...priceTable].sort((a, b) =>
      Math.abs((a.moisture_pct ?? 0) - m) - Math.abs((b.moisture_pct ?? 0) - m)
    );
    return sorted[0] ? String(sorted[0].price_per_kg) : '';
  }

  function handleChange(field: keyof RawInputs, value: string) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      // auto-fill ราคาเมื่อกรอกความชื้น
      if (field === 'moisture_current' && value) next.price_current = findPrice(value);
      if (field === 'moisture_target'  && value) next.price_target  = findPrice(value);
      return next;
    });
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

  function handleReset() { setValues(EMPTY_INPUTS); setErrors({}); setResult(null); }

  // สรุปตารางราคาที่มีอยู่ให้ user ดู
  const priceHint = priceTable.length > 0
    ? priceTable.sort((a, b) => (b.moisture_pct ?? 0) - (a.moisture_pct ?? 0))
        .map((p) => `${p.moisture_pct}% = ${p.price_per_kg} ฿/กก.`).join('  •  ')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* แสดงตารางราคาปัจจุบัน */}
      {priceHint && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 11, color: '#166534', fontWeight: 500 }}>💰 ราคารับซื้อปัจจุบัน (กรอกความชื้น → ราคาเติมให้อัตโนมัติ)</p>
          <p style={{ margin: 0, fontSize: 11, color: '#15803d', lineHeight: 1.8 }}>{priceHint}</p>
        </div>
      )}

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
          <button className="admin-btn admin-btn--secondary" onClick={handleReset} style={{ fontSize: 13, padding: '8px 16px' }}>
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
