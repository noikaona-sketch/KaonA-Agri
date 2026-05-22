'use client';

import { rainRisk }               from './moisture-calculator';
import type { CalcResult, Deduction } from './moisture-calculator';

type WeatherDay = { date: string; rain_prob: number; rain_mm: number };
type RainRiskLevel = 'low' | 'medium' | 'high';

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const RISK_CFG = {
  low:    { color:'#166534', bg:'#f0fdf4', label:'⛅ ฝนน้อย' },
  medium: { color:'#854d0e', bg:'#fefce8', label:'🌦️ อาจมีฝน' },
  high:   { color:'#991b1b', bg:'#fef2f2', label:'🌧️ ฝนตกหนัก' },
};

// ── Practical suggestion ─────────────────────────────────────────────────────
const DELTA_NOTABLE = 300   // ผลต่าง > 300 บาท = มีนัยสำคัญ

type SuggestionResult = { icon: string; color: string; bg: string; text: string };

function buildSuggestion(
  waitDays       : number,
  delta          : number,
  rain           : RainRiskLevel,
  futureMoisture : number | null,
): SuggestionResult | null {
  if (!futureMoisture) return null;

  if (delta >= DELTA_NOTABLE && rain === 'low')
    return { icon:'✅', color:'#166534', bg:'#f0fdf4',
      text: `ฟ้าใสอีก ${waitDays} วัน — รอน่าจะได้เพิ่ม ฿${fmt(delta)}` };

  if (delta >= DELTA_NOTABLE && rain === 'medium')
    return { icon:'🟡', color:'#854d0e', bg:'#fefce8',
      text: `รอ ${waitDays} วันอาจได้เพิ่ม ฿${fmt(delta)} แต่มีโอกาสฝน — ประเมินแปลงก่อน` };

  if (delta >= DELTA_NOTABLE && rain === 'high')
    return { icon:'⛔', color:'#991b1b', bg:'#fef2f2',
      text: `มีฝนหนัก — แม้รอ ${waitDays} วันอาจได้เพิ่ม ฿${fmt(delta)} แต่ความชื้นอาจสูงขึ้นได้` };

  if (Math.abs(delta) < DELTA_NOTABLE && rain === 'low')
    return { icon:'🔵', color:'#185FA5', bg:'#E6F1FB',
      text: `ผลต่างไม่มาก — ขายเลยหรือรอก็ได้ตามสะดวก` };

  if (Math.abs(delta) < DELTA_NOTABLE && rain !== 'low')
    return { icon:'🌧️', color:'#991b1b', bg:'#fef2f2',
      text: `ผลต่างไม่มากและมีฝนมา — ขายเลยปลอดภัยกว่า` };

  if (delta < -DELTA_NOTABLE)
    return { icon:'⚠️', color:'#854d0e', bg:'#fefce8',
      text: `ขายเลยดีกว่า — รอ ${waitDays} วันอาจได้น้อยลง ฿${fmt(Math.abs(delta))}` };

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
type Props = {
  waitDays      : number
  onSetWaitDays : (d: number) => void
  futureMoisture: number | null
  futureResult  : CalcResult | null
  currentRevenue: number | null
  weather       : WeatherDay[]
  deductions    : Deduction[]
}

export function HarvestTimingPanel({
  waitDays, onSetWaitDays, futureMoisture, futureResult, currentRevenue, weather,
}: Props) {
  const maxRainProb = weather.length > 0 ? Math.max(0, ...weather.map((w) => w.rain_prob)) : 0;
  const rain        = rainRisk(maxRainProb);
  const riskCfg     = RISK_CFG[rain];
  const delta       = futureResult ? (futureResult.revenue_baht - (currentRevenue ?? 0)) : 0;
  const suggestion  = futureResult ? buildSuggestion(waitDays, delta, rain, futureMoisture) : null;

  return (
    <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Day selector */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:500, color:'#6b7280' }}>⏳ ถ้าเลื่อนเกี่ยว</p>
        <div style={{ display:'flex', gap:6 }}>
          {[1,2,3,5,7].map((d) => (
            <button key={d} onClick={() => onSetWaitDays(d)}
              className={`admin-btn ${waitDays===d ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize:12, padding:'4px 10px', minHeight:32 }}>{d} วัน</button>
          ))}
        </div>
      </div>

      {/* คำแนะนำหลัก — แสดงเด่นชัด */}
      {suggestion && (
        <div style={{ background: suggestion.bg, border:`1px solid ${suggestion.color}33`,
          borderRadius:12, padding:'12px 14px' }}>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color: suggestion.color }}>
            {suggestion.icon} {suggestion.text}
          </p>
        </div>
      )}

      {/* รายละเอียดรายได้ */}
      {futureResult && (
        <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px',
          display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>ความชื้นที่คาดว่าจะเป็น</span>
            <span style={{ fontSize:13, fontWeight:600 }}>{futureMoisture?.toFixed(1)}%</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>รายได้คาดการณ์</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#1b5e20' }}>฿{fmt(futureResult.revenue_baht)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>เทียบกับขายเลย</span>
            <span style={{ fontSize:13, fontWeight:600, color: delta >= 0 ? '#166534' : '#c62828' }}>
              {delta >= 0 ? `+฿${fmt(delta)}` : `−฿${fmt(Math.abs(delta))}`}
            </span>
          </div>
        </div>
      )}

      {/* พยากรณ์รายวัน */}
      {weather.length > 0 && (
        <div style={{ background: riskCfg.bg, borderRadius:10, padding:'10px 12px' }}>
          <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:600, color: riskCfg.color }}>
            {riskCfg.label} — {waitDays} วันข้างหน้า (สูงสุด {maxRainProb}%)
          </p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {weather.slice(0, waitDays).map((w) => (
              <div key={w.date} style={{ flex:1, minWidth:52, textAlign:'center', background:'#fff',
                borderRadius:8, padding:'6px 4px', border:`1px solid ${riskCfg.color}33` }}>
                <p style={{ margin:'0 0 2px', fontSize:10, color:'#6b7280' }}>
                  {new Date(w.date).toLocaleDateString('th-TH', { weekday:'short', day:'numeric' })}
                </p>
                <p style={{ margin:'0 0 1px', fontSize:14, fontWeight:700,
                  color: w.rain_prob>=60 ? '#991b1b' : w.rain_prob>=30 ? '#854d0e' : '#166534' }}>
                  {w.rain_prob}%
                </p>
                <p style={{ margin:0, fontSize:10, color:'#9ca3af' }}>{w.rain_mm.toFixed(1)} มม.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>
        ⚠️ คำแนะนำนี้เป็นการประมาณการเท่านั้น ขึ้นอยู่กับสภาพอากาศและแปลงจริง
      </p>
    </div>
  );
}
