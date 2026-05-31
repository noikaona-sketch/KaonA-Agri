'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { HarvestRatingForm } from '@/features/service-rating/harvest-rating-form';
import { UIButton } from '@/shared/components/ui-button';
import { HarvestBookingForm }        from './harvest-booking-form';
import { FarmActivityChecklist }     from '@/features/farm-activity/farm-activity-checklist';
import { MemberHarvestBookingForm }  from '@/features/member-harvest/harvest-booking-form';
import { SaleAppointmentForm } from './sale-appointment-form';
import { ErrorState } from '@/shared/components/error-state';

type ProductRef = { name: string; seed_variety: string | null; days_to_harvest: number | null; planting_guide: string | null; fertilizer_guide: string | null };
type PlotRef = { id: string; name: string; province: string | null };

type Cycle = {
  id: string; crop_name: string; season_year: number; status: string; burn_practice: string | null; burn_practice_note: string | null;
  planted_at: string | null; expected_harvest_at: string | null;
  area_planted_rai: number | null; estimated_yield_kg: number | null;
  quota_kg: number | null; source: string | null; confirmed_at: string | null;
  member_note: string | null; seed_qty_used: number | null;
  expected_yield_per_rai_kg: number | null;
  expected_price_per_kg: number | null;
  expected_cost_per_rai: number | null;
  expected_cost_per_rai_burn: number | null;
  expected_cost_per_rai_no_burn: number | null;
  products: ProductRef | null;
  plots: PlotRef | null;
};

type CycleQueryRow = Omit<Cycle, 'products' | 'plots'> & {
  products: ProductRef | ProductRef[] | null;
  plots: PlotRef | PlotRef[] | null;
};

type Progress = {
  id: string; stage: string; description: string | null; recorded_at: string;
};

type Plot = { id: string; name: string; province: string | null };

const STAGES: { value: string; icon: string; label: string }[] = [
  { value: 'prepared',   icon: '🏗️', label: 'เตรียมดิน' },
  { value: 'planted',    icon: '🌱', label: 'ปลูกแล้ว' },
  { value: 'germinated', icon: '🌿', label: 'งอก' },
  { value: 'growing',    icon: '🌿', label: 'กำลังโต' },
  { value: 'flowering',  icon: '🌸', label: 'ออกดอก' },
  { value: 'fruiting',   icon: '🌽', label: 'ติดผล' },
  { value: 'maturing',   icon: '🟡', label: 'กำลังแก่' },
  { value: 'ready',      icon: '✅', label: 'พร้อมเก็บ' },
  { value: 'issue',      icon: '⚠️', label: 'พบปัญหา' },
];

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCycle(row: CycleQueryRow | null): Cycle | null {
  if (!row) return null;
  return {
    ...row,
    products: firstRelation(row.products),
    plots: firstRelation(row.plots),
  };
}

export function PlantingCycleDetail({ cycleId }: { cycleId: string }) {
  const member = useCurrentMember();
  const memberId = member?.member_id;
  const [cycle, setCycle]     = useState<Cycle | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [plots, setPlots]     = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [showConfirm, setShowConfirm]   = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showRating,   setShowRating]   = useState(false);
  const [showBooking,  setShowBooking]  = useState(false);
  const [showSale,     setShowSale]     = useState(false);

  // Burn practice self-declaration (#217)
  const [burnPractice,     setBurnPractice]     = useState<string>('unknown');
  const [burnPracticeNote, setBurnPracticeNote] = useState<string>('');
  const [savingBurn,       setSavingBurn]       = useState(false);
  const [burnNotice,       setBurnNotice]       = useState<string | null>(null);
  const [selectedPlot, setSelectedPlot] = useState('');
  const [plantedDate, setPlantedDate]   = useState('');
  const [areaRai, setAreaRai]           = useState('');
  const [newStage, setNewStage]         = useState('');
  const [stageDesc, setStageDesc]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [notice, setNotice]             = useState<string | null>(null);
  const [economics, setEconomics]       = useState({
    expectedYieldPerRaiKg: '',
    expectedPricePerKg: '',
    expectedCostPerRai: '',
    expectedCostPerRaiBurn: '',
    expectedCostPerRaiNoBurn: '',
  });
  const [savingEconomics, setSavingEconomics] = useState(false);
  const [economicsNotice, setEconomicsNotice] = useState<string | null>(null);

  async function load() {
    const s = createSupabaseBrowserClient();
    const [cRes, pRes, plotsRes] = await Promise.all([
      s.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,area_planted_rai,estimated_yield_kg,quota_kg,source,confirmed_at,member_note,seed_qty_used,burn_practice,burn_practice_note,expected_yield_per_rai_kg,expected_price_per_kg,expected_cost_per_rai,expected_cost_per_rai_burn,expected_cost_per_rai_no_burn,products(name,seed_variety,days_to_harvest,planting_guide,fertilizer_guide),plots(id,name,province)')
        .eq('id', cycleId).maybeSingle(),
      s.from('planting_cycle_progress')
        .select('id,stage,description,recorded_at')
        .eq('planting_cycle_id', cycleId)
        .order('recorded_at', { ascending: false }),
      memberId
        ? s.from('plots').select('id,name,province').eq('member_id', memberId).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ]);
    if (cRes.error) { setError(cRes.error.message); setLoading(false); return; }
    const normalizedCycle = normalizeCycle(cRes.data as unknown as CycleQueryRow | null);
    setCycle(normalizedCycle);
    setProgress((pRes.data as Progress[]) ?? []);
    setPlots(((plotsRes as { data: unknown[] }).data as Plot[]) ?? []);
    if (normalizedCycle) {
      setSelectedPlot(normalizedCycle.plots?.id ?? '');
      setPlantedDate(normalizedCycle.planted_at?.slice(0, 10) ?? '');
      setAreaRai(String(normalizedCycle.area_planted_rai ?? ''));
      // Sync burn practice state from DB
      setBurnPractice(normalizedCycle.burn_practice ?? 'unknown');
      setBurnPracticeNote(normalizedCycle.burn_practice_note ?? '');
      setEconomics({
        expectedYieldPerRaiKg: normalizedCycle.expected_yield_per_rai_kg != null ? String(normalizedCycle.expected_yield_per_rai_kg) : '',
        expectedPricePerKg: normalizedCycle.expected_price_per_kg != null ? String(normalizedCycle.expected_price_per_kg) : '',
        expectedCostPerRai: normalizedCycle.expected_cost_per_rai != null ? String(normalizedCycle.expected_cost_per_rai) : '',
        expectedCostPerRaiBurn: normalizedCycle.expected_cost_per_rai_burn != null ? String(normalizedCycle.expected_cost_per_rai_burn) : '',
        expectedCostPerRaiNoBurn: normalizedCycle.expected_cost_per_rai_no_burn != null ? String(normalizedCycle.expected_cost_per_rai_no_burn) : '',
      });
    }
    setLoading(false);
  }

  async function saveEconomics() {
    setSavingEconomics(true);
    setEconomicsNotice(null);
    const s = createSupabaseBrowserClient();
    const parse = (v: string) => {
      if (!v.trim()) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const payload = {
      expected_yield_per_rai_kg: parse(economics.expectedYieldPerRaiKg),
      expected_price_per_kg: parse(economics.expectedPricePerKg),
      expected_cost_per_rai: parse(economics.expectedCostPerRai),
      expected_cost_per_rai_burn: parse(economics.expectedCostPerRaiBurn),
      expected_cost_per_rai_no_burn: parse(economics.expectedCostPerRaiNoBurn),
      updated_at: new Date().toISOString(),
    };
    const { error } = await s.from('planting_cycles').update(payload).eq('id', cycleId);
    setSavingEconomics(false);
    if (error) {
      setEconomicsNotice(`❌ บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    setEconomicsNotice('✅ บันทึกข้อมูลเศรษฐศาสตร์การปลูกแล้ว');
    await load();
  }

  useEffect(() => { void load(); }, [cycleId, memberId]);

  async function confirmPlanting() {
    if (!selectedPlot || !plantedDate) return;
    setSaving(true);
    const s = createSupabaseBrowserClient();
    const { error: err } = await s.rpc('confirm_planting_date', {
      p_cycle_id: cycleId, p_plot_id: selectedPlot,
      p_planted_at: plantedDate,
      p_area_rai: areaRai ? Number(areaRai) : null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNotice('✅ บันทึกวันปลูกแล้ว'); setShowConfirm(false); await load();
  }

  async function addProgress() {
    if (!newStage || !memberId) return;
    setSaving(true);
    const s = createSupabaseBrowserClient();
    await s.from('planting_cycle_progress').insert({
      planting_cycle_id: cycleId, member_id: memberId,
      stage: newStage, description: stageDesc || null,
    });
    await s.from('planting_cycles').update({ status: newStage, updated_at: new Date().toISOString() }).eq('id', cycleId);
    setSaving(false);
    setNewStage(''); setStageDesc(''); setShowProgress(false);
    setNotice('✅ บันทึกความคืบหน้าแล้ว'); await load();
  }

  // Save burn_practice self-declaration
  async function saveBurnPractice() {
    if (!cycleId || !burnPractice || burnPractice === 'unknown') return;
    setSavingBurn(true);
    setBurnNotice(null);
    const s = createSupabaseBrowserClient();
    const { error } = await s.from('planting_cycles').update({
      burn_practice:      burnPractice,
      burn_practice_note: burnPracticeNote.trim() || null,
      updated_at:         new Date().toISOString(),
    }).eq('id', cycleId);
    setSavingBurn(false);
    if (error) {
      setBurnNotice(`❌ บันทึกไม่สำเร็จ: ${error.message}`);
    } else {
      setBurnNotice('✅ บันทึกข้อมูลการจัดการตอซังแล้ว');
      setCycle((prev) => prev ? { ...prev, burn_practice: burnPractice, burn_practice_note: burnPracticeNote.trim() || null } : prev);
    }
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !cycle) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const days = daysUntil(cycle.expected_harvest_at);
  const needConfirm = cycle.source === 'order' && !cycle.confirmed_at;
  const expectedYield = Number(economics.expectedYieldPerRaiKg) || 0;
  const expectedPrice = Number(economics.expectedPricePerKg) || 0;
  const expectedCost = Number(economics.expectedCostPerRai) || 0;
  const expectedRevenue = expectedYield * expectedPrice;
  const expectedProfit = expectedRevenue - expectedCost;
  const burnCost = Number(economics.expectedCostPerRaiBurn) || expectedCost;
  const noBurnCost = Number(economics.expectedCostPerRaiNoBurn) || expectedCost;
  const burnProfit = expectedRevenue - burnCost;
  const noBurnProfit = expectedRevenue - noBurnCost;

  return (
    <div className="mobile-stack" style={{ paddingBottom: 24 }}>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}
      <div style={{ background: 'linear-gradient(145deg,#1b5e20,#2e7d32)', borderRadius: 20, padding: 20, color: '#fff' }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, opacity: 0.8 }}>{cycle.source === 'order' ? '🛒 จากคำสั่งซื้อ' : '✏️ สร้างเอง'}</p>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900 }}>{cycle.crop_name} {cycle.season_year}</h2>
        {cycle.products?.seed_variety && <p style={{ margin: '0 0 10px', fontSize: 14, opacity: 0.85 }}>พันธุ์ {cycle.products.seed_variety}</p>}
        {cycle.plots && <p style={{ margin: '0 0 4px', fontSize: 14 }}>📍 {cycle.plots.name} {cycle.plots.province ? `(${cycle.plots.province})` : ''}</p>}
        {days !== null && (
          <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 700, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 12px', display: 'inline-block' }}>
            {days > 0 ? `🌽 เก็บเกี่ยวใน ${days} วัน` : days === 0 ? '🎉 เก็บเกี่ยวได้วันนี้!' : '⚠️ เลยวันเก็บเกี่ยวแล้ว'}
          </p>
        )}
      </div>

      {needConfirm && (
        <div style={{ background: '#fff8e1', border: '2px solid #ffe082', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: '#e65100' }}>⚠️ ยังไม่ได้ระบุแปลงและวันปลูก</p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#7b5800' }}>กรุณาระบุข้อมูลเพื่อเริ่มติดตามการเพาะปลูก</p>
          <UIButton fullWidth onClick={() => setShowConfirm(true)}>📅 ระบุแปลงและวันปลูก</UIButton>
        </div>
      )}

      <div className="kaona-card">
        <p style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 16 }}>💰 เศรษฐศาสตร์การปลูก (เบื้องต้น)</p>
        <div className="mobile-stack" style={{ gap: 10 }}>
          <label className="reg-label">ต้นทุนคาดการณ์ต่อไร่ (บาท)
            <input className="reg-input" type="number" step="0.01" value={economics.expectedCostPerRai} onChange={(e) => setEconomics((p) => ({ ...p, expectedCostPerRai: e.target.value }))} placeholder="3500" />
          </label>
          <label className="reg-label">ผลผลิตคาดการณ์ต่อไร่ (กก.)
            <input className="reg-input" type="number" step="0.01" value={economics.expectedYieldPerRaiKg} onChange={(e) => setEconomics((p) => ({ ...p, expectedYieldPerRaiKg: e.target.value }))} placeholder="1200" />
          </label>
          <label className="reg-label">ราคาขายคาดการณ์ต่อกก. (บาท)
            <input className="reg-input" type="number" step="0.01" value={economics.expectedPricePerKg} onChange={(e) => setEconomics((p) => ({ ...p, expectedPricePerKg: e.target.value }))} placeholder="8.5" />
          </label>
          <div style={{ background: '#f7faf7', border: '1px solid #dce8dc', borderRadius: 12, padding: 12 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>สรุปต่อไร่</p>
            <p style={{ margin: 0, fontSize: 14 }}>รายได้คาดการณ์: <b>{expectedRevenue.toLocaleString()} บาท</b></p>
            <p style={{ margin: '6px 0 0', fontSize: 14 }}>กำไรคาดการณ์: <b>{expectedProfit.toLocaleString()} บาท</b></p>
          </div>
          <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: 14 }}>เปรียบเทียบการจัดการตอซัง (ฐานข้อมูลเริ่มต้น)</p>
          <label className="reg-label">ต้นทุนแบบเผา (บาท/ไร่)
            <input className="reg-input" type="number" step="0.01" value={economics.expectedCostPerRaiBurn} onChange={(e) => setEconomics((p) => ({ ...p, expectedCostPerRaiBurn: e.target.value }))} placeholder="3200" />
          </label>
          <label className="reg-label">ต้นทุนแบบไม่เผา (บาท/ไร่)
            <input className="reg-input" type="number" step="0.01" value={economics.expectedCostPerRaiNoBurn} onChange={(e) => setEconomics((p) => ({ ...p, expectedCostPerRaiNoBurn: e.target.value }))} placeholder="3800" />
          </label>
          <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 12, padding: 12, fontSize: 14 }}>
            <p style={{ margin: 0 }}>กำไรคาดการณ์ (เผา): <b>{burnProfit.toLocaleString()} บาท/ไร่</b></p>
            <p style={{ margin: '6px 0 0' }}>กำไรคาดการณ์ (ไม่เผา): <b>{noBurnProfit.toLocaleString()} บาท/ไร่</b></p>
          </div>
          {economicsNotice && <p style={{ margin: 0, fontWeight: 700 }}>{economicsNotice}</p>}
          <UIButton fullWidth onClick={saveEconomics} loading={savingEconomics} disabled={savingEconomics}>บันทึกข้อมูลเศรษฐศาสตร์</UIButton>
        </div>
      </div>

      {showConfirm && (
        <div className="kaona-card">
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>📅 ยืนยันข้อมูลการปลูก</p>
          <div className="mobile-stack" style={{ gap: 10 }}>
            <label className="reg-label">เลือกแปลง <span className="reg-required">*</span>
              <select className="reg-input" value={selectedPlot} onChange={(e) => setSelectedPlot(e.target.value)}>
                <option value="">เลือกแปลง…</option>
                {plots.map((p) => <option key={p.id} value={p.id}>{p.name} {p.province ? `(${p.province})` : ''}</option>)}
              </select>
            </label>
            <label className="reg-label">วันที่ปลูกจริง <span className="reg-required">*</span>
              <input className="reg-input" type="date" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
            </label>
            <label className="reg-label">พื้นที่ปลูก (ไร่)
              <input className="reg-input" type="number" step="0.5" value={areaRai} onChange={(e) => setAreaRai(e.target.value)} placeholder="0.0" />
            </label>
            {cycle.products?.days_to_harvest && plantedDate && (
              <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#1b5e20', fontWeight: 600 }}>
                🌽 คาดเก็บเกี่ยว: {new Date(new Date(plantedDate).getTime() + cycle.products.days_to_harvest * 86400000).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <UIButton variant="ghost" onClick={() => setShowConfirm(false)}>ยกเลิก</UIButton>
              <UIButton onClick={confirmPlanting} loading={saving} disabled={!selectedPlot || !plantedDate}>บันทึก</UIButton>
            </div>
          </div>
        </div>
      )}

      <div className="kaona-card">
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>📊 ข้อมูลรอบปลูก</p>
        {[
          ['วันปลูก', cycle.planted_at ? new Date(cycle.planted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          ['คาดเก็บเกี่ยว', cycle.expected_harvest_at ? new Date(cycle.expected_harvest_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          ['พื้นที่', cycle.area_planted_rai ? `${cycle.area_planted_rai} ไร่` : '—'],
          ['คาดผลผลิต', cycle.estimated_yield_kg ? `${cycle.estimated_yield_kg.toLocaleString()} กก.` : '—'],
          ['โควต้าขาย', cycle.quota_kg ? `${cycle.quota_kg.toLocaleString()} กก.` : '—'],
        ].map(([k, v]) => (
          <div key={String(k)} className="info-row">
            <span className="info-row__label">{k}</span>
            <span className="info-row__value">{v}</span>
          </div>
        ))}
      </div>

      {cycle.products?.planting_guide && (
        <div className="kaona-card" style={{ background: '#f1f8e9', borderColor: '#c5e1a5' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: '#2e7d32' }}>🌱 คู่มือการปลูก</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#33691e' }}>{cycle.products.planting_guide}</p>
        </div>
      )}

      {/* ── Farm Activity Checklist ── */}
      {cycle.confirmed_at && !['cancelled'].includes(cycle.status) && (
        <FarmActivityChecklist
          cycleId={cycleId}
          plotId={cycle.plots?.id ?? null}
          seedHint={cycle.products ? {
            fertilizer_guide: cycle.products.fertilizer_guide,
            planting_guide:   cycle.products.planting_guide,
          } : null}
        />
      )}

      {cycle.confirmed_at && !['harvested','cancelled'].includes(cycle.status) && (
        <UIButton fullWidth variant="secondary" onClick={() => setShowProgress(true)}>
          📸 บันทึกความคืบหน้า
        </UIButton>
      )}

      {/* นัดรถเกี่ยว — เมื่อใกล้เก็บเกี่ยว (≤30 วัน) หรือ status = ready */}
      {cycle.confirmed_at && cycle.expected_harvest_at &&
       !['harvested','cancelled'].includes(cycle.status) && (
        <UIButton fullWidth onClick={() => setShowBooking(true)}>
          🚜 นัดรถเกี่ยว
        </UIButton>
      )}

      {/* นัดขาย — เมื่อ confirmed แล้ว */}
      {cycle.confirmed_at && !['cancelled'].includes(cycle.status) && (
        <UIButton fullWidth variant="secondary" onClick={() => setShowSale(true)}>
          🌽 นัดวันขายผลผลิต
        </UIButton>
      )}

      {/* ประเมิน — เมื่อเกี่ยวเสร็จ */}
      {cycle.status === 'harvested' && (
        <UIButton fullWidth variant="secondary" onClick={() => setShowRating(true)}>
          ⭐ ประเมินผู้ให้บริการ
        </UIButton>
      )}

      {showProgress && (
        <div className="kaona-card">
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>📸 บันทึกสถานะล่าสุด</p>
          <div className="mobile-stack" style={{ gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STAGES.map((s) => (
                <button key={s.value} onClick={() => setNewStage(s.value)}
                  style={{ padding: '10px', borderRadius: 12, border: `2px solid ${newStage === s.value ? 'var(--primary)' : 'var(--border)'}`, background: newStage === s.value ? '#e8f5e9' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <label className="reg-label">รายละเอียด (ถ้ามี)
              <textarea className="reg-input reg-textarea" rows={2} value={stageDesc} onChange={(e) => setStageDesc(e.target.value)} placeholder="พบโรค / ใส่ปุ๋ย / ฝนตก…" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <UIButton variant="ghost" onClick={() => setShowProgress(false)}>ยกเลิก</UIButton>
              <UIButton onClick={addProgress} loading={saving} disabled={!newStage}>บันทึก</UIButton>
            </div>
          </div>
        </div>
      )}

      {progress.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 15 }}>📅 ประวัติการติดตาม</p>
          {progress.map((p) => {
            const st = STAGES.find((s) => s.value === p.stage);
            return (
              <div key={p.id} className="activity-item">
                <div className="activity-dot">{st?.icon ?? '📌'}</div>
                <div>
                  <p className="activity-item__text">{st?.label ?? p.stage}</p>
                  {p.description && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{p.description}</p>}
                  <p className="activity-item__time">{new Date(p.recorded_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Harvest Booking modal */}
      {showBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => setShowBooking(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
              ← ยกเลิก
            </button>
            <HarvestBookingForm
              cycleId={cycle.id}
              memberId={memberId ?? ''}
              plotId={cycle.plots?.id ?? null}
              expectedHarvestAt={cycle.expected_harvest_at}
              cropName={cycle.crop_name}
              estimatedYieldKg={cycle.estimated_yield_kg}
              onDone={() => { setShowBooking(false); }}
              onCancel={() => setShowBooking(false)}
            />
          </div>
        </div>
      )}

      {/* Sale Appointment modal */}
      {showSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => setShowSale(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
              ← ยกเลิก
            </button>
            <SaleAppointmentForm
              cycleId={cycle.id}
              memberId={memberId ?? ''}
              cropName={cycle.crop_name}
              estimatedYieldKg={cycle.estimated_yield_kg}
              quotaKg={cycle.quota_kg}
              onDone={() => { setShowSale(false); }}
              onCancel={() => setShowSale(false)}
            />
          </div>
        </div>
      )}

      {/* Rating modal */}
      {/* ── P2: Farmer harvest forecast — shown when cycle is maturing/ready ── */}
      {['maturing', 'fruiting', 'ready'].includes(cycle.status) && (
        <MemberHarvestBookingForm
          cycleId={cycle.id}
          cropName={cycle.crop_name}
          plotId={cycle.plots?.id ?? undefined}
        />
      )}

      {/* ── Burn/no-burn self-declaration (continuity tracking #217) ── */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 15 }}>
          🔥 การจัดการตอซังหลังเก็บเกี่ยว
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          บันทึกวิธีจัดการตอซังในรอบนี้เพื่อติดตามแนวโน้มในระยะยาว
        </p>

        {/* Practice options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {([
            { value: 'no_burn', label: '🌿 ไม่เผา',       color: '#2e7d32', bg: '#e8f5e9' },
            { value: 'partial', label: '⚠️ บางส่วน',     color: '#e65100', bg: '#fff3e0' },
            { value: 'burn',    label: '🔥 เผา',          color: '#c62828', bg: '#ffebee' },
            { value: 'unknown', label: '❓ ยังไม่ระบุ',  color: '#9e9e9e', bg: '#f5f5f5' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBurnPractice(opt.value)}
              style={{
                padding: '10px 8px', borderRadius: 10, border: '2px solid',
                borderColor: burnPractice === opt.value ? opt.color : '#e5e7eb',
                background:  burnPractice === opt.value ? opt.bg : '#fff',
                cursor: 'pointer', fontWeight: 700, fontSize: 13,
                color: burnPractice === opt.value ? opt.color : 'var(--text-secondary)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Note */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            รายละเอียดเพิ่มเติม (ไม่บังคับ)
          </span>
          <textarea
            rows={2}
            value={burnPracticeNote}
            onChange={(e) => setBurnPracticeNote(e.target.value)}
            placeholder="เช่น ไฟลามจากแปลงข้างเคียง, ไถกลบตอซัง, ทำปุ๋ยหมัก"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #d1d5db', padding: '8px 10px', fontSize: 13, resize: 'vertical', marginTop: 4 }}
          />
        </label>

        {/* Notice */}
        {burnNotice && (
          <p style={{ margin: '0 0 10px', fontSize: 13,
            color: burnNotice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
            {burnNotice}
          </p>
        )}

        <button
          type="button"
          onClick={() => void saveBurnPractice()}
          disabled={savingBurn || burnPractice === 'unknown'}
          style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none',
            background: savingBurn || burnPractice === 'unknown' ? '#e5e7eb' : '#2e7d32',
            color: savingBurn || burnPractice === 'unknown' ? '#9ca3af' : '#fff',
            fontWeight: 700, fontSize: 14, cursor: burnPractice === 'unknown' ? 'not-allowed' : 'pointer',
          }}
        >
          {savingBurn ? 'กำลังบันทึก…' : 'บันทึกข้อมูลการจัดการตอซัง'}
        </button>
      </div>

      {showRating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: '16px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => setShowRating(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
              ← ยกเลิก
            </button>
            <HarvestRatingForm
              bookingId={cycle.id}
              providerMemberId="unknown"
              providerName="ผู้ให้บริการ"
              ratedByMemberId={memberId ?? ''}
              onDone={() => { setShowRating(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
