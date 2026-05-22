'use client';

import type { CalcResult } from './moisture-calculator';

const VERDICT_CFG = {
  worth_it:     { icon: '✅', label: 'คุ้มค่า',       sub: 'ราคาที่ได้เพิ่มชดเชยน้ำหนักที่หายไปได้',     bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
  similar:      { icon: '🟡', label: 'ใกล้เคียงกัน',  sub: 'ราคาที่ได้เพิ่มกับน้ำหนักที่เสียไปใกล้เคียงกัน', bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
  not_worth_it: { icon: '🔴', label: 'ไม่คุ้มค่า',    sub: 'น้ำหนักที่เสียไปมีมูลค่ามากกว่าราคาที่ได้เพิ่ม', bg: '#FCEBEB', color: '#791F1F', border: '#F7C1C1' },
} satisfies Record<CalcResult['verdict'], { icon:string; label:string; sub:string; bg:string; color:string; border:string }>;

const DISCLAIMER = [
  'ตัวเลขนี้เป็นการประมาณการเบื้องต้นเท่านั้น',
  'ราคาและเงื่อนไขจริงขึ้นอยู่กับโรงงาน ณ วันรับซื้อ',
  'ความชื้นจริงอาจแตกต่างจากที่ประมาณ — ควรวัดก่อนนำส่ง',
];

const fmt = (n: number, d = 0) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 0', borderBottom: '1px solid #f0f4f0' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: color ?? '#111' }}>
        {value}{sub && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{sub}</span>}
      </span>
    </div>
  );
}

type Props = { result: CalcResult | null; moistureTarget: string; compact?: boolean }

export function CalculatorResult({ result, moistureTarget, compact = false }: Props) {
  if (!result) return null;
  const v = VERDICT_CFG[result.verdict];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#6b7280' }}>── ผลการคำนวณ ──</p>

      {/* Comparison cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'ขายตอนนี้', weight: result.weight_after_kg + result.weight_loss_kg, value: result.value_now_baht },
          { label: `ที่ความชื้น ${moistureTarget}%`, weight: result.weight_after_kg, value: result.value_after_baht },
        ].map((col) => (
          <div key={col.label} style={{ flex:1, textAlign:'center', padding:'10px 8px',
            background:'#f9fafb', borderRadius:10, border:'0.5px solid #e4ede4' }}>
            <p style={{ margin:'0 0 4px', fontSize:12, color:'#6b7280', fontWeight:500 }}>{col.label}</p>
            <p style={{ margin:'0 0 2px', fontSize:17, fontWeight:500, color:'#111' }}>{fmt(col.weight)} กก.</p>
            <p style={{ margin:0, fontSize:13, color:'#3B6D11', fontWeight:500 }}>฿{fmt(col.value)}</p>
          </div>
        ))}
      </div>

      {/* Breakdown: น้ำหนักที่เสีย vs ราคาที่ได้ */}
      <div style={{ background:'#f9fafb', borderRadius:10, padding:'4px 12px' }}>
        <Row label="น้ำหนักที่หายไป" value={`${fmt(result.weight_loss_kg, 1)} กก.`} />
        <Row label="มูลค่าที่เสียจากน้ำหนัก" value={`−฿${fmt(result.baht_lost_from_weight)}`} color="#c62828" />
        <Row label="มูลค่าที่ได้จากราคาดีขึ้น" value={`+฿${fmt(result.baht_gained_from_price)}`} color="#2e7d32" />
      </div>

      {/* Verdict */}
      <div style={{ textAlign:'center', padding:'14px 16px', borderRadius:12,
        background:v.bg, border:`1px solid ${v.border}` }}>
        <p style={{ margin:'0 0 4px', fontSize:18, fontWeight:500, color:v.color }}>{v.icon} {v.label}</p>
        <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:500, color:v.color }}>
          {result.delta_baht >= 0 ? `ได้เพิ่มขึ้น +฿${fmt(result.delta_baht)}` : `ได้ลดลง −฿${fmt(Math.abs(result.delta_baht))}`}
        </p>
        <p style={{ margin:0, fontSize:12, color:v.color, opacity:0.85 }}>{v.sub}</p>
      </div>

      {/* Disclaimer */}
      {compact ? (
        <details style={{ fontSize:12 }}>
          <summary style={{ cursor:'pointer', color:'#9ca3af', userSelect:'none' }}>⚠️ ข้อควรระวัง</summary>
          <div style={{ marginTop:6, paddingLeft:10, borderLeft:'3px solid #e5e7eb' }}>
            {DISCLAIMER.map((l,i) => <p key={i} style={{ margin: i===0 ? 0:'3px 0 0', color:'#9ca3af' }}>• {l}</p>)}
          </div>
        </details>
      ) : (
        <div style={{ background:'#f9f9f9', borderLeft:'3px solid #d1d5db', padding:'10px 12px', borderRadius:'0 8px 8px 0' }}>
          <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:500, color:'#6b7280' }}>⚠️ ข้อควรระวัง</p>
          {DISCLAIMER.map((l,i) => <p key={i} style={{ margin: i===0 ? 0:'3px 0 0', fontSize:12, color:'#9ca3af' }}>• {l}</p>)}
        </div>
      )}
    </div>
  );
}
