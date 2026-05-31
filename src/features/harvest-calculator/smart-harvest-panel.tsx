'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember }    from '@/providers/auth-provider';
import {
  calcRevenue, estimateMoistureByAge, estimateMoistureAfterDays,
  growthStageLabel, nearestDeduction,
} from './moisture-calculator';
import type { Deduction, Promo, CalcResult } from './moisture-calculator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Cycle = {
  id: string; crop_name: string; season_year: number;
  planted_at: string | null; expected_harvest_at: string | null;
  area_planted_rai: number | null; estimated_yield_kg: number | null;
  quota_kg: number | null;
};

type HarvestBooking = {
  id: string; scheduled_date: string | null; expected_date_from: string;
  estimated_tonnage: number; status: string;
};

type SaleAppt = {
  id: string; scheduled_date: string;
  estimated_qty_kg: number; status: string;
};

type ApiData = { deductions: Deduction[]; base_price_per_kg: number | null; promos: Promo[] };

const fmt  = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmt2 = (n: number) => n.toFixed(2);

type ScenarioResult = {
  label:      string;
  icon:       string;
  date:       Date;
  dayLabel:   string;
  moisture:   number;
  result:     CalcResult;
  highlight:  boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
export function SmartHarvestPanel() {
  const member = useCurrentMember();

  const [cycles,   setCycles]   = useState<Cycle[]>([]);
  const [selCycle, setSelCycle] = useState<Cycle | null>(null);
  const [bookings, setBookings] = useState<HarvestBooking[]>([]);
  const [saleAppts,setSaleAppts]= useState<SaleAppt[]>([]);
  const [apiData,  setApiData]  = useState<ApiData | null>(null);
  const [weight,   setWeight]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [scenarios,setScenarios]= useState<ScenarioResult[]>([]);

  // ── Load cycles ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!member?.member_id) return;
    void fetch(`/api/member/planting-cycles?member_id=${member.member_id}`)
      .then(r => r.json())
      .then((j: { cycles?: Cycle[] }) => {
        const c = (j.cycles ?? []).filter(c => c.planted_at);
        setCycles(c);
        if (c.length === 1) setSelCycle(c[0]);
      });
  }, [member?.member_id]);

  // ── Load bookings + sale appts + deductions when cycle selected ────────────
  useEffect(() => {
    if (!selCycle || !member?.member_id) return;
    setLoading(true);
    void (async () => {
      const [bRes, sRes, dRes] = await Promise.all([
        fetch(`/api/member/harvest-bookings?member_id=${member.member_id}`).then(r => r.json()),
        fetch(`/api/member/sale-appointment?member_id=${member.member_id}`).then(r => r.json()),
        fetch('/api/moisture-deductions?crop_type=ข้าวโพด').then(r => r.json()),
      ]);
      setBookings((bRes.bookings ?? []).filter((b: HarvestBooking) => !['cancelled','completed'].includes(b.status)));
      setSaleAppts((sRes.appointments ?? sRes.sale_appointments ?? []).filter((s: SaleAppt) => s.status !== 'cancelled'));
      setApiData(dRes as ApiData);
      setLoading(false);
    })();
  }, [selCycle?.id, member?.member_id]);

  // ── Compute scenarios ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selCycle?.planted_at || !apiData?.deductions.length || !apiData.base_price_per_kg) return;

    const plantedAt    = new Date(selCycle.planted_at);
    const today        = new Date();
    const daysOld      = Math.floor((today.getTime() - plantedAt.getTime()) / 86400000);
    const weightKg     = weight ? Number(weight) * 1000 : (selCycle.quota_kg ?? selCycle.estimated_yield_kg ?? 0);
    if (!weightKg) return;

    const results: ScenarioResult[] = [];

    function addScenario(label: string, icon: string, targetDate: Date, highlight = false) {
      const days        = Math.max(0, Math.floor((targetDate.getTime() - today.getTime()) / 86400000));
      const ageAtDate   = daysOld + days;
      const moisture    = estimateMoistureByAge(ageAtDate);
      const result      = calcRevenue(moisture, weightKg, apiData!.base_price_per_kg!, apiData!.deductions, apiData!.promos);
      const diff        = Math.abs(targetDate.getTime() - today.getTime());
      const dayLabel    = days === 0 ? 'วันนี้'
                        : days === 1 ? 'พรุ่งนี้'
                        : `อีก ${days} วัน`;
      results.push({ label, icon, date: targetDate, dayLabel, moisture, result, highlight });
    }

    // Scenario 1: วันนี้
    addScenario('ขายวันนี้', '⚡', today);

    // Scenario 2: นัดเกี่ยว (ถ้ามี)
    for (const b of bookings) {
      const d = b.scheduled_date ?? b.expected_date_from;
      addScenario(`นัดเกี่ยว${bookings.length > 1 ? ` #${bookings.indexOf(b)+1}` : ''}`, '🚜', new Date(d), true);
    }

    // Scenario 3: นัดขาย (ถ้ามี)
    for (const s of saleAppts) {
      addScenario(`นัดขาย${saleAppts.length > 1 ? ` #${saleAppts.indexOf(s)+1}` : ''}`, '📅', new Date(s.scheduled_date), true);
    }

    // Scenario 4: วันเก็บเกี่ยวที่ตั้งใจ (expected_harvest_at)
    if (selCycle.expected_harvest_at) {
      addScenario('วันเก็บเกี่ยวที่วางแผน', '🌾', new Date(selCycle.expected_harvest_at));
    }

    // Scenario 5: รอให้แห้ง (+7 วัน, +14 วัน)
    [7, 14].forEach(d => {
      const target = new Date(today); target.setDate(target.getDate() + d);
      addScenario(`รอแห้ง +${d} วัน`, '⏳', target);
    });

    // Sort by date
    results.sort((a, b) => a.date.getTime() - b.date.getTime());
    setScenarios(results);
  }, [selCycle, apiData, bookings, saleAppts, weight]);

  // ─────────────────────────────────────────────────────────────────────────
  const today          = new Date();
  const plantedAt      = selCycle?.planted_at ? new Date(selCycle.planted_at) : null;
  const daysOld        = plantedAt ? Math.floor((today.getTime() - plantedAt.getTime()) / 86400000) : null;
  const stage          = daysOld !== null ? growthStageLabel(daysOld) : null;
  const estimatedMoist = daysOld !== null ? estimateMoistureByAge(daysOld) : null;
  const bestScenario   = scenarios.reduce<ScenarioResult | null>((best, s) =>
    !best || s.result.revenue_baht > best.result.revenue_baht ? s : best, null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Cycle selector ── */}
      {cycles.length > 1 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>เลือกรอบปลูก</p>
          <div style={{ position: 'relative' }}>
            <select value={selCycle?.id ?? ''} onChange={e => setSelCycle(cycles.find(c => c.id === e.target.value) ?? null)}
              style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 12, border: '1.5px solid #d1d5db', appearance: 'none', WebkitAppearance: 'none', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">-- เลือกรอบปลูก --</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.crop_name} {c.season_year}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}>▾</span>
          </div>
        </div>
      )}

      {/* ── Crop age + stage ── */}
      {selCycle && daysOld !== null && stage && (
        <div style={{ background: `${stage.color}15`, border: `1px solid ${stage.color}40`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 22 }}>{stage.icon}</p>
              <p style={{ margin: '4px 0 0', fontWeight: 900, fontSize: 15, color: stage.color }}>{stage.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                อายุ <strong>{daysOld}</strong> วัน
                {selCycle.expected_harvest_at && (() => {
                  const left = Math.ceil((new Date(selCycle.expected_harvest_at).getTime() - today.getTime()) / 86400000);
                  return left > 0 ? <span style={{ marginLeft: 8, color: '#e65100' }}>เหลืออีก {left} วัน</span>
                                  : <span style={{ marginLeft: 8, color: '#c62828' }}>เลยกำหนด {Math.abs(left)} วัน</span>;
                })()}
              </p>
            </div>
            {estimatedMoist !== null && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: stage.color }}>{estimatedMoist}%</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>ความชื้นโดยประมาณ</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Weight input ── */}
      {selCycle && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>
            น้ำหนักที่จะขาย (ตัน)
            {selCycle.quota_kg && !weight && (
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                ค่าเริ่มต้น: {(selCycle.quota_kg / 1000).toFixed(1)} ตัน (โควต้า)
              </span>
            )}
          </p>
          <input type="number" inputMode="decimal" value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder={selCycle.quota_kg ? `${(selCycle.quota_kg / 1000).toFixed(1)}` : 'เช่น 6'}
            className="reg-input" />
        </div>
      )}

      {/* ── Scenarios comparison ── */}
      {scenarios.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800 }}>📊 เปรียบเทียบรายได้</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenarios.map((s, i) => {
              const isBest = bestScenario?.label === s.label;
              const diff   = s.result.revenue_baht - (scenarios[0]?.result.revenue_baht ?? 0);
              return (
                <div key={i} style={{
                  borderRadius: 14, border: `1.5px solid ${isBest ? '#2e7d32' : s.highlight ? '#90caf9' : '#e5e7eb'}`,
                  background:        isBest ? '#f0fdf4' : s.highlight ? '#e3f2fd' : '#fff',
                  padding: '12px 14px', position: 'relative',
                }}>
                  {isBest && (
                    <span style={{ position: 'absolute', top: -10, left: 14, background: '#2e7d32', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>
                      💰 รายได้สูงสุด
                    </span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: isBest ? '#1b5e20' : '#111' }}>
                        {s.icon} {s.label}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        {s.dayLabel} · ความชื้น {s.moisture}% · {fmt2(s.result.final_price_per_kg)} บ./กก.
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                        น้ำหนักหลังหัก {fmt(s.result.weight_deducted_kg)} กก.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: isBest ? '#1b5e20' : '#111' }}>
                        ฿{fmt(s.result.revenue_baht)}
                      </p>
                      {i > 0 && diff !== 0 && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: diff > 0 ? '#2e7d32' : '#c62828' }}>
                          {diff > 0 ? `+฿${fmt(diff)}` : `-฿${fmt(Math.abs(diff))}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selCycle && !apiData && !loading && (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>กำลังโหลดข้อมูลราคา…</p>
      )}
      {loading && <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>กำลังโหลด…</p>}
      {cycles.length === 0 && !loading && (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>ยังไม่มีรอบปลูกที่ระบุวันปลูก</p>
      )}
    </div>
  );
}
