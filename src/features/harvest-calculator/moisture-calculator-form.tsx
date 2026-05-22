'use client';

import { useEffect, useRef, useState } from 'react';
import { calcRevenue, estimateMoistureAfterDays, nearestDeduction, rainRisk } from './moisture-calculator';
import type { Deduction, CalcResult }  from './moisture-calculator';

type WeatherDay = { date: string; rain_prob: number; rain_mm: number };
type ApiData    = { deductions: Deduction[]; base_price_per_kg: number | null; weather: WeatherDay[] };

const fmt = (n: number, d = 0) => n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });

type Props = { memberId?: string; compact?: boolean };

export function MoistureCalculatorForm({ memberId, compact = false }: Props) {
  const [data,     setData]     = useState<ApiData | null>(null);
  const [plotLat,  setPlotLat]  = useState<number | null>(null);
  const [plotLng,  setPlotLng]  = useState<number | null>(null);
  const [moisture, setMoisture] = useState('');
  const [weight,   setWeight]   = useState('');
  const [result,   setResult]   = useState<CalcResult | null>(null);
  const [waitDays, setWaitDays] = useState(3);
  const resultRef               = useRef<HTMLDivElement>(null);

  // โหลด plot GPS + ตารางส่วนลด + weather
  useEffect(() => {
    if (!memberId) { void loadData(null, null); return; }
    void (async () => {
      const r = await fetch(`/api/member/plots?member_id=${memberId}`);
      const d = (await r.json()) as { plots?: { lat: number | null; lng: number | null }[] };
      const p = d.plots?.[0];
      const lat = p?.lat ?? null;
      const lng = p?.lng ?? null;
      setPlotLat(lat); setPlotLng(lng);
      await loadData(lat, lng);
    })();
  }, [memberId]);

  async function loadData(lat: number | null, lng: number | null) {
    const q = lat && lng ? `&lat=${lat}&lng=${lng}&days=${waitDays}` : '';
    const r = await fetch(`/api/moisture-deductions?crop_type=ข้าวโพด${q}`);
    setData((await r.json()) as ApiData);
  }

  function calculate() {
    if (!data || !moisture || !weight) return;
    const r = calcRevenue(Number(moisture), Number(weight), data.base_price_per_kg ?? 0, data.deductions);
    setResult(r);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  const moistureOptions = data?.deductions.map((d) => d.moisture_pct) ?? [];
  const maxRainProb     = data ? Math.max(0, ...data.weather.map((w) => w.rain_prob)) : 0;
  const risk            = rainRisk(maxRainProb);
  const riskCfg         = { low: { color:'#166534', bg:'#f0fdf4', label:'⛅ ฝนน้อย' }, medium: { color:'#854d0e', bg:'#fefce8', label:'🌦️ อาจมีฝน' }, high: { color:'#991b1b', bg:'#fef2f2', label:'🌧️ ฝนตกหนัก' } }[risk];

  // คาดการณ์ถ้ารอ waitDays วัน
  const futureMoisture = moisture && data
    ? estimateMoistureAfterDays(Number(moisture), waitDays, data.deductions)
    : null;
  const futureDeduction = futureMoisture && data ? nearestDeduction(futureMoisture, data.deductions) : null;
  const futureResult    = futureMoisture && weight && data
    ? calcRevenue(futureDeduction?.moisture_pct ?? futureMoisture, Number(weight), data.base_price_per_kg ?? 0, data.deductions)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ราคาฐาน */}
      {data?.base_price_per_kg && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'8px 12px' }}>
          <p style={{ margin:0, fontSize:12, color:'#166534' }}>
            💰 ราคาฐาน (เปียก 30%) = <b>{Number(data.base_price_per_kg).toFixed(2)} บาท/กก.</b>
            &nbsp;— ยิ่งความชื้นต่ำ ส่วนลดยิ่งน้อย ได้เงินมากขึ้น
          </p>
        </div>
      )}

      {/* Input */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 12px', fontSize:13, fontWeight:500, color:'#6b7280' }}>── กรอกข้อมูล ──</p>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <label className="reg-label">ความชื้นปัจจุบัน (%) <span className="reg-required">✱</span>
            <select className="reg-input" value={moisture} onChange={(e) => { setMoisture(e.target.value); setResult(null); }}>
              <option value="">— เลือกความชื้น —</option>
              {moistureOptions.map((m) => <option key={m} value={m}>{m}%</option>)}
            </select>
          </label>
          <label className="reg-label">น้ำหนักคาดการณ์ (กก.) <span className="reg-required">✱</span>
            <input className="reg-input" type="number" inputMode="decimal" step="1" min="0"
              placeholder="เช่น 5,000" value={weight}
              onChange={(e) => { setWeight(e.target.value); setResult(null); }} />
          </label>
        </div>
      </div>

      <button className="admin-btn admin-btn--primary" onClick={calculate}
        disabled={!moisture || !weight || !data}
        style={{ minHeight:52, fontSize:16, fontWeight:500 }}>
        คำนวณรายได้
      </button>

      {/* ผลการคำนวณ */}
      <div ref={resultRef}>
        {result && (
          <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:500, color:'#6b7280' }}>── รายได้ที่คาดว่าจะได้ ──</p>
            {[
              { label:'น้ำหนักที่กรอก',        value:`${fmt(result.weight_input_kg)} กก.` },
              { label:`หัก ${result.weight_deduct_pct}% น้ำหนัก`, value:`−${fmt(result.weight_loss_kg,1)} กก.`, red:true },
              { label:'น้ำหนักที่โรงงานชั่ง',   value:`${fmt(result.weight_deducted_kg,1)} กก.`, bold:true },
              { label:'ราคาฐาน (เปียก 30%)',   value:`${result.base_price_per_kg.toFixed(2)} บาท/กก.` },
              { label:`บวกราคา +${result.price_adjust_per_kg.toFixed(2)} บาท/กก.`, value:`+${result.price_adjust_per_kg.toFixed(2)} บาท/กก.`, green:true },
              { label:'ราคาจริง',               value:`${result.price_after_adjust.toFixed(2)} บาท/กก.`, bold:true },
            ].map(({ label, value, red, green, bold }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f4f0' }}>
                <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
                <span style={{ fontSize:14, fontWeight: bold ? 700 : 500, color: red ? '#c62828' : green ? '#2e7d32' : '#111' }}>{value}</span>
              </div>
            ))}
            <div style={{ background:'#EAF3DE', borderRadius:10, padding:'12px 14px', textAlign:'center', marginTop:4 }}>
              <p style={{ margin:'0 0 4px', fontSize:13, color:'#27500A' }}>รายได้ที่คาดว่าจะได้</p>
              <p style={{ margin:0, fontSize:26, fontWeight:700, color:'#1b5e20' }}>฿{fmt(result.revenue_baht)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Timing panel — ถ้ารอ N วัน */}
      {moisture && weight && data && (
        <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:500, color:'#6b7280' }}>⏳ ถ้าเลื่อนเกี่ยว</p>
            <div style={{ display:'flex', gap:6 }}>
              {[1,2,3,5,7].map((d) => (
                <button key={d} onClick={() => setWaitDays(d)}
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
              {futureResult.revenue_baht > (result?.revenue_baht ?? 0) ? (
                <p style={{ margin:0, fontSize:12, color:'#166534', background:'#f0fdf4', borderRadius:6, padding:'4px 8px' }}>
                  ✅ รอดีกว่า ได้เพิ่ม +฿{fmt(futureResult.revenue_baht - (result?.revenue_baht ?? 0))}
                </p>
              ) : (
                <p style={{ margin:0, fontSize:12, color:'#92400e', background:'#fffbeb', borderRadius:6, padding:'4px 8px' }}>
                  🟡 ได้น้อยกว่าถ้าขายเลย −฿{fmt((result?.revenue_baht ?? 0) - futureResult.revenue_baht)}
                </p>
              )}
            </div>
          )}

          {/* Weather risk */}
          {data.weather.length > 0 && (
            <div style={{ background: riskCfg.bg, borderRadius:10, padding:'10px 12px' }}>
              <p style={{ margin:'0 0 6px', fontSize:13, fontWeight:600, color: riskCfg.color }}>
                {riskCfg.label} — {waitDays} วันข้างหน้า (สูงสุด {maxRainProb}%)
              </p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {data.weather.slice(0, waitDays).map((w) => (
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
            ⚠️ การคาดการณ์ความชื้นและรายได้เป็นการประมาณการเท่านั้น
          </p>
        </div>
      )}
    </div>
  );
}
