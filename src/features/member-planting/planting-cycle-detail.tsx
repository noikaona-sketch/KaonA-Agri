'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { HarvestRatingForm } from '@/features/service-rating/harvest-rating-form';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';

type ProductRef = { name: string; seed_variety: string | null; days_to_harvest: number | null; planting_guide: string | null };
type PlotRef = { id: string; name: string; province: string | null };

type Cycle = {
  id: string; crop_name: string; season_year: number; status: string;
  planted_at: string | null; expected_harvest_at: string | null;
  area_planted_rai: number | null; estimated_yield_kg: number | null;
  quota_kg: number | null; source: string | null; confirmed_at: string | null;
  member_note: string | null; seed_qty_used: number | null;
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
  const [showRating, setShowRating]     = useState(false);
  const [selectedPlot, setSelectedPlot] = useState('');
  const [plantedDate, setPlantedDate]   = useState('');
  const [areaRai, setAreaRai]           = useState('');
  const [newStage, setNewStage]         = useState('');
  const [stageDesc, setStageDesc]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [notice, setNotice]             = useState<string | null>(null);

  async function load() {
    const s = createSupabaseBrowserClient();
    const [cRes, pRes, plotsRes] = await Promise.all([
      s.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,area_planted_rai,estimated_yield_kg,quota_kg,source,confirmed_at,member_note,seed_qty_used,products(name,seed_variety,days_to_harvest,planting_guide),plots(id,name,province)')
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
    }
    setLoading(false);
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

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !cycle) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const days = daysUntil(cycle.expected_harvest_at);
  const needConfirm = cycle.source === 'order' && !cycle.confirmed_at;

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

      {cycle.confirmed_at && !['harvested','cancelled'].includes(cycle.status) && (
        <UIButton fullWidth variant="secondary" onClick={() => setShowProgress(true)}>
          📸 บันทึกความคืบหน้า
        </UIButton>
      )}

      {/* ปุ่มประเมินผู้ให้บริการ — แสดงเมื่อเกี่ยวเสร็จ */}
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
      {/* Rating modal */}
      {showRating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: '16px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => setShowRating(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
              ← ยกเลิก
            </button>
            <HarvestRatingForm
              bookingId={cycle.source_order_id ?? cycle.id}
              providerMemberId="unknown"
              providerName="ผู้ให้บริการ"
              ratedByMemberId={cycle.member_id ?? ''}
              onDone={() => { setShowRating(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
