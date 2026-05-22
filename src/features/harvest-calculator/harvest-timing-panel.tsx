'use client';

import { rainRisk }    from './moisture-calculator';
import type { CalcResult, Deduction } from './moisture-calculator';

type WeatherDay = { date: string; rain_prob: number; rain_mm: number };

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const RISK_CFG = {
  low:    { color:'#166534', bg:'#f0fdf4', label:'⛅ ฝนน้อย' },
  medium: { color:'#854d0e', bg:'#fefce8', label:'🌦️ อาจมีฝน' },
  high:   { color:'#991b1b', bg:'#fef2f2', label:'🌧️ ฝนตกหนัก' },
};

type Props = {
  waitDays      : number
  onSetWaitDays : (d: number) => void
  futureMoisture: number | null
  futureResult  : CalcResult | null
  currentRevenue: number | null
  weather       : WeatherDay[]
  deductions    : Deduction[]
}

export function HarvestTimingPanel({ waitDays, onSetWaitDays, futureMoisture, futureResult, currentRevenue, weather }: Props) {
  const maxRainProb = Math.max(0, ...weather.map((w) => w.rain_prob));
  const risk        = rainRisk(maxRainProb);
  const riskCfg     = RISK_CFG[risk];

  return (
    <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
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

      {futureResult && (
        <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, color:'#6b7280' }}>ความชื้นที่คาดว่าจะเป็น</span>
            <span style={{ fontSize:14, fontWeight:600 }}>{futureMoisture?.toFixed(1)}%</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, color:'#6b7280' }}>รายได้คาดการณ์</span>
            <span style={{ fontSize:15, fontWeight:700, color:'#1b5e20' }}>฿{fmt(futureResult.revenue_baht)}</span>
          </div>
          {futureResult.revenue_baht > (currentRevenue ?? 0) ? (
            <p style={{ margin:0, fontSize:12, color:'#166534', background:'#f0fdf4', borderRadius:6, padding:'4px 8px' }}>
              ✅ รอดีกว่า ได้เพิ่ม +฿{fmt(futureResult.revenue_baht - (currentRevenue ?? 0))}
            </p>
          ) : (
            <p style={{ margin:0, fontSize:12, color:'#92400e', background:'#fffbeb', borderRadius:6, padding:'4px 8px' }}>
              🟡 ได้น้อยกว่าถ้าขายเลย −฿{fmt((currentRevenue ?? 0) - futureResult.revenue_baht)}
            </p>
          )}
        </div>
      )}

      {weather.length > 0 && (
        <div style={{ background: riskCfg.bg, borderRadius:10, padding:'10px 12px' }}>
          <p style={{ margin:'0 0 6px', fontSize:13, fontWeight:600, color: riskCfg.color }}>
            {riskCfg.label} — {waitDays} วันข้างหน้า (สูงสุด {maxRainProb}%)
          </p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {weather.slice(0, waitDays).map((w) => (
              <div key={w.date} style={{ flex:1, minWidth:60, textAlign:'center', background:'#fff', borderRadius:8, padding:'6px 4px', border:`1px solid ${riskCfg.color}33` }}>
                <p style={{ margin:'0 0 2px', fontSize:10, color:'#6b7280' }}>
                  {new Date(w.date).toLocaleDateString('th-TH', { weekday:'short', day:'numeric' })}
                </p>
                <p style={{ margin:'0 0 1px', fontSize:14, fontWeight:700, color: w.rain_prob>=60 ? '#991b1b' : w.rain_prob>=30 ? '#854d0e' : '#166534' }}>
                  {w.rain_prob}%
                </p>
                <p style={{ margin:0, fontSize:10, color:'#9ca3af' }}>{w.rain_mm.toFixed(1)} มม.</p>
              </div>
            ))}
          </div>
          {risk === 'high' && (
            <p style={{ margin:'6px 0 0', fontSize:12, color:'#991b1b', fontWeight:500 }}>
              ⚠️ มีฝนตกหนัก — ความชื้นอาจไม่ลดตามที่คาดและอาจเพิ่มขึ้นได้
            </p>
          )}
        </div>
      )}

      <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>
        ⚠️ การคาดการณ์เป็นการประมาณการเท่านั้น ขึ้นอยู่กับสภาพอากาศและแปลง
      </p>
    </div>
  );
}
