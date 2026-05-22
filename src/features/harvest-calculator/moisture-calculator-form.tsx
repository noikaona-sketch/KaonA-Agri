'use client';

import { useEffect, useRef, useState }                                   from 'react';
import { calcRevenue, estimateMoistureAfterDays, nearestDeduction }      from './moisture-calculator';
import type { Deduction, CalcResult }                                    from './moisture-calculator';
import { HarvestTimingPanel }                                            from './harvest-timing-panel';

type WeatherDay  = { date: string; rain_prob: number; rain_mm: number };
type MemberBonus = { bonus_per_kg: number; title: string; end_date: string };
type ApiData     = { deductions: Deduction[]; base_price_per_kg: number | null; weather: WeatherDay[]; member_bonus: MemberBonus | null };

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

type Props = { memberId?: string; compact?: boolean };

export function MoistureCalculatorForm({ memberId, compact = false }: Props) {
  const [data,     setData]     = useState<ApiData | null>(null);
  const [moisture, setMoisture] = useState('');
  const [weight,   setWeight]   = useState('');
  const [result,   setResult]   = useState<CalcResult | null>(null);
  const [waitDays, setWaitDays] = useState(3);
  const resultRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      let lat: number | null = null, lng: number | null = null;
      if (memberId) {
        const r = await fetch(`/api/member/plots?member_id=${memberId}`);
        const d = (await r.json()) as { plots?: { lat: number | null; lng: number | null }[] };
        lat = d.plots?.[0]?.lat ?? null;
        lng = d.plots?.[0]?.lng ?? null;
      }
      const q   = lat && lng ? `&lat=${lat}&lng=${lng}&days=7` : '';
      const res = await fetch(`/api/moisture-deductions?crop_type=ข้าวโพด${q}`);
      setData((await res.json()) as ApiData);
    })();
  }, [memberId]);

  function calculate() {
    if (!data || !moisture || !weight) return;
    const bonus = data.member_bonus?.bonus_per_kg ?? 0;
    setResult(calcRevenue(Number(moisture), Number(weight), data.base_price_per_kg ?? 0, data.deductions, bonus));
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  const bonus          = data?.member_bonus?.bonus_per_kg ?? 0;
  const futureMoisture = moisture && data ? estimateMoistureAfterDays(Number(moisture), waitDays, data.deductions) : null;
  const futureDeduction= futureMoisture && data ? nearestDeduction(futureMoisture, data.deductions) : null;
  const futureResult   = futureMoisture && weight && data
    ? calcRevenue(futureDeduction?.moisture_pct ?? futureMoisture, Number(weight), data.base_price_per_kg ?? 0, data.deductions, bonus)
    : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* โบนัสโปรโมชั่น */}
      {data?.member_bonus && (
        <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:10, padding:'8px 12px' }}>
          <p style={{ margin:0, fontSize:12, color:'#92400e', fontWeight:600 }}>
            🎁 {data.member_bonus.title} — สมาชิก KaonA ได้รับโบนัส +{data.member_bonus.bonus_per_kg.toFixed(2)} บาท/กก.
            <span style={{ fontWeight:400, marginLeft:6 }}>
              ถึง {new Date(data.member_bonus.end_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}
            </span>
          </p>
        </div>
      )}

      {/* ราคาฐาน */}
      {data?.base_price_per_kg && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'8px 12px' }}>
          <p style={{ margin:0, fontSize:12, color:'#166534' }}>
            💰 ราคาฐาน (เปียก 30%) = <b>{Number(data.base_price_per_kg).toFixed(2)} บาท/กก.</b>
            &nbsp;— ยิ่งความชื้นต่ำ ได้ราคาสูงขึ้น
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
              {(data?.deductions ?? []).map((d) => <option key={d.moisture_pct} value={d.moisture_pct}>{d.moisture_pct}%</option>)}
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
        style={{ minHeight: compact ? 40 : 52, fontSize: compact ? 14 : 16, fontWeight:500 }}>
        คำนวณรายได้
      </button>

      {/* ผลคำนวณ */}
      <div ref={resultRef}>
        {result && (
          <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:500, color:'#6b7280' }}>── รายได้ที่คาดว่าจะได้ ──</p>
            {[
              { label:'น้ำหนักที่กรอก',               value:`${fmt(result.weight_input_kg)} กก.` },
              { label:`หัก ${result.weight_deduct_pct}% น้ำหนัก`, value:`−${fmt(result.weight_loss_kg)} กก.`, red:true },
              { label:'น้ำหนักที่โรงงานชั่ง',          value:`${result.weight_deducted_kg.toFixed(1)} กก.`, bold:true },
              { label:'ราคาฐาน (เปียก 30%)',          value:`${result.base_price_per_kg.toFixed(2)} บาท/กก.` },
              { label:`+บวกตามความชื้น ${result.moisture_pct}%`, value:`+${result.price_adjust_per_kg.toFixed(2)} บาท/กก.`, green:true },
              ...(result.member_bonus_per_kg > 0 ? [{ label:'🎁 โบนัสสมาชิก', value:`+${result.member_bonus_per_kg.toFixed(2)} บาท/กก.`, green:true, bold:false, red:false }] : []),
              { label:'ราคาสุดท้าย', value:`${result.final_price_per_kg.toFixed(2)} บาท/กก.`, bold:true },
            ].map(({ label, value, red, green, bold }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f0f4f0' }}>
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

      {/* Timing + weather */}
      {moisture && weight && data && (
        <HarvestTimingPanel
          waitDays={waitDays} onSetWaitDays={setWaitDays}
          futureMoisture={futureMoisture} futureResult={futureResult}
          currentRevenue={result?.revenue_baht ?? null}
          weather={data.weather} deductions={data.deductions}
        />
      )}
    </div>
  );
}
