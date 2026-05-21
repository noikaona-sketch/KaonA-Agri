'use client';

import type { CalcResult } from './moisture-calculator';

const VERDICT_CFG = {
  worth_it:     { icon: '✅', label: 'คุ้มค่า',        sub: 'การรอให้ความชื้นลดน่าจะได้เงินมากขึ้น', bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
  similar:      { icon: '🟡', label: 'ใกล้เคียงกัน',   sub: 'ผลต่างไม่มากนัก ขึ้นอยู่กับปัจจัยอื่น',   bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
  not_worth_it: { icon: '🔴', label: 'ไม่คุ้มค่า',     sub: 'น้ำหนักที่เสียไปมากกว่าราคาที่ได้เพิ่ม',  bg: '#FCEBEB', color: '#791F1F', border: '#F7C1C1' },
} satisfies Record<CalcResult['verdict'], { icon: string; label: string; sub: string; bg: string; color: string; border: string }>;

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ColBox({ title, weight, value }: { title: string; weight: number; value: number }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#f9fafb', borderRadius: 10, border: '0.5px solid #e4ede4' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{title}</p>
      <p style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 500, color: '#111' }}>{fmt(weight)} กก.</p>
      <p style={{ margin: 0, fontSize: 13, color: '#3B6D11', fontWeight: 500 }}>฿{fmt(value)}</p>
    </div>
  );
}

const DISCLAIMER_LINES = [
  'ตัวเลขนี้เป็นการประมาณการเบื้องต้นเท่านั้น',
  'ราคาและเงื่อนไขจริงขึ้นอยู่กับโรงงาน ณ วันรับซื้อ',
  'ความชื้นจริงอาจแตกต่างจากที่ประมาณ — ควรวัดก่อนนำส่ง',
  'เครื่องมือนี้ช่วยประกอบการตัดสินใจ ไม่ใช่คำแนะนำจากโรงงาน',
];

type Props = {
  result         : CalcResult | null
  moistureTarget : string
  compact?       : boolean
}

export function CalculatorResult({ result, moistureTarget, compact = false }: Props) {
  if (!result) return null;

  const vcfg  = VERDICT_CFG[result.verdict];
  const delta = result.delta_baht;
  const deltaText = delta >= 0 ? `ได้เพิ่มขึ้น +฿${fmt(delta)}` : `ได้ลดลง −฿${fmt(Math.abs(delta))}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section header */}
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#6b7280' }}>── ผลการคำนวณ ──</p>

      {/* Comparison columns */}
      <div style={{ display: 'flex', gap: 8 }}>
        <ColBox title="ขายเลย" weight={result.weight_after_kg + result.weight_loss_kg} value={result.value_now_baht} />
        <ColBox title={`รอขาย (${moistureTarget}%)`} weight={result.weight_after_kg} value={result.value_after_baht} />
      </div>

      {/* Verdict */}
      <div style={{ textAlign: 'center', padding: '14px 16px', borderRadius: 12, background: vcfg.bg, border: `1px solid ${vcfg.border}` }}>
        <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 500, color: vcfg.color }}>
          {vcfg.icon} {vcfg.label}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: vcfg.color, fontWeight: 500 }}>{deltaText}</p>
        <p style={{ margin: 0, fontSize: 12, color: vcfg.color, opacity: 0.8 }}>{vcfg.sub}</p>
      </div>

      {/* Detail */}
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
        น้ำหนักที่หายไป {fmt(result.weight_loss_kg, 1)} กก.
      </p>

      {/* Disclaimer */}
      {compact ? (
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', userSelect: 'none' }}>⚠️ ดูข้อควรระวัง</summary>
          <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: '3px solid #d1d5db' }}>
            {DISCLAIMER_LINES.map((l, i) => <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0', color: '#6b7280' }}>• {l}</p>)}
          </div>
        </details>
      ) : (
        <div style={{ background: '#f9f9f9', borderLeft: '3px solid #d1d5db', borderRadius: '0 8px 8px 0', padding: '10px 12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#374151' }}>⚠️ ข้อควรระวัง</p>
          {DISCLAIMER_LINES.map((l, i) => <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0', fontSize: 12, color: '#6b7280' }}>• {l}</p>)}
        </div>
      )}
    </div>
  );
}
