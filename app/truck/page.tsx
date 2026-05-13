'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type HarvestJob = {
  id: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  status: string;
  truck_status: string | null;
  actual_yield_kg: number | null;
  quality_grade: string | null;
  quality_moisture: number | null;
  note: string | null;
  planting_cycles: {
    crop_name: string;
    area_planted_rai: number | null;
    estimated_yield_kg: number | null;
    plots: { name: string; province: string | null; lat: number | null; lng: number | null } | null;
  } | null;
  members: { full_name: string; phone: string | null } | null;
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '⏳ รอยืนยัน',   color: '#e65100', bg: '#fff8e1' },
  confirmed: { label: '✅ ยืนยัน',      color: '#1565c0', bg: '#e3f2fd' },
  completed: { label: '🏁 เสร็จแล้ว',  color: '#9e9e9e', bg: '#f5f5f5' },
  cancelled: { label: '⛔ ยกเลิก',      color: '#9e9e9e', bg: '#f5f5f5' },
};

const TRUCK_STATUS_STEPS = [
  { key: 'waiting',  label: '🏠 รอออกรถ' },
  { key: 'on_way',   label: '🚛 เดินทาง' },
  { key: 'arrived',  label: '📍 ถึงแปลง' },
  { key: 'loading',  label: '⚙️ กำลังเกี่ยว' },
  { key: 'done',     label: '✅ เสร็จ' },
];

export default function TruckPage() {
  const member = useCurrentMember();
  const [jobs, setJobs]         = useState<HarvestJob[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeJob, setActiveJob] = useState<HarvestJob | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [yieldKg, setYieldKg]   = useState('');
  const [moisture, setMoisture] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [filter, setFilter]     = useState<'active' | 'all'>('active');

  async function load() {
    if (!member?.member_id) return;
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('harvest_bookings')
      .select(`id,scheduled_date,scheduled_time_start,scheduled_time_end,status,truck_status,actual_yield_kg,quality_grade,quality_moisture,note,
        planting_cycles(crop_name,area_planted_rai,estimated_yield_kg,plots(name,province,lat,lng)),
        members(full_name,phone)`)
      .eq('truck_member_id', member.member_id)
      .order('scheduled_date', { ascending: true });
    if (filter === 'active') q = q.in('status', ['pending', 'confirmed']);
    const { data } = await q;
    setJobs((data as HarvestJob[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id, filter]);

  async function updateTruckStatus(jobId: string, truckStatus: string) {
    setUpdating(true);
    const s = createSupabaseBrowserClient();
    await s.from('harvest_bookings').update({
      truck_status: truckStatus,
      status: truckStatus === 'done' ? 'completed' : 'confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    setUpdating(false);
    setNotice(`✅ อัปเดต: ${TRUCK_STATUS_STEPS.find((s) => s.key === truckStatus)?.label}`);
    await load();
    if (activeJob?.id === jobId) {
      setActiveJob((p) => p ? { ...p, truck_status: truckStatus } : p);
    }
  }

  async function saveResult(jobId: string) {
    setUpdating(true);
    const s = createSupabaseBrowserClient();
    await s.from('harvest_bookings').update({
      actual_yield_kg: yieldKg ? Number(yieldKg) : null,
      quality_moisture: moisture ? Number(moisture) : null,
      quality_grade: moisture ? (Number(moisture) <= 14.5 ? 'A' : Number(moisture) <= 18 ? 'B' : Number(moisture) <= 25 ? 'C' : 'reject') : null,
      note: resultNote || null,
      status: 'completed',
      truck_status: 'done',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
    setUpdating(false);
    setShowResult(false); setActiveJob(null);
    setNotice('✅ บันทึกผลการเกี่ยวแล้ว');
    await load();
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <MobileAppShell title="งานรถเกี่ยว" subtitle="รายการงานที่ได้รับมอบหมาย">
      <div className="mobile-stack">

        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}

        {/* filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['active', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: filter === f ? 'var(--primary)' : '#f0f4f0', color: filter === f ? '#fff' : 'var(--text-secondary)' }}>
              {f === 'active' ? 'งานปัจจุบัน' : 'ทั้งหมด'}
            </button>
          ))}
        </div>

        {loading && <LoadingState label="กำลังโหลดงาน…" />}
        {!loading && jobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48 }}>🚛</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0' }}>ไม่มีงานที่ได้รับมอบหมาย</p>
          </div>
        )}

        {jobs.map((job) => {
          const st = STATUS_CFG[job.status] ?? STATUS_CFG.pending;
          const isToday = job.scheduled_date === todayStr;
          const plot = job.planting_cycles?.plots;

          return (
            <div key={job.id} className="kaona-card"
              style={{ borderColor: isToday ? '#a5d6a7' : st.color + '44', background: isToday ? '#f1f8f1' : '#fff' }}>

              {isToday && <span style={{ fontSize: 11, fontWeight: 700, color: '#2e7d32', background: '#e8f5e9', borderRadius: 999, padding: '2px 8px', display: 'inline-block', marginBottom: 8 }}>📅 วันนี้</span>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{plot?.name ?? 'แปลงไม่ระบุ'}</p>
                  {plot?.province && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{plot.province}</p>}
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {job.planting_cycles?.crop_name} {job.planting_cycles?.area_planted_rai ? `· ${job.planting_cycles.area_planted_rai} ไร่` : ''}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                    👤 {job.members?.full_name ?? '—'}
                    {job.members?.phone && (
                      <a href={`tel:${job.members.phone}`} style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 700 }}>
                        📞 โทร
                      </a>
                    )}
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {st.label}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                🗓️ {new Date(job.scheduled_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                {job.scheduled_time_start && ` · ${job.scheduled_time_start} — ${job.scheduled_time_end ?? '—'}`}
              </div>

              {/* GPS */}
              {plot?.lat && plot?.lng && (
                <a href={`https://maps.google.com/?q=${plot.lat},${plot.lng}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', marginBottom: 8 }}>
                  📍 เปิด Google Maps
                </a>
              )}

              {/* Truck status stepper — เฉพาะงาน confirmed */}
              {job.status === 'confirmed' && (
                <div style={{ borderTop: '1px solid #f0f4f0', paddingTop: 10 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>อัปเดตสถานะรถ</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TRUCK_STATUS_STEPS.map((step) => {
                      const isActive = job.truck_status === step.key;
                      return (
                        <button key={step.key}
                          onClick={() => updateTruckStatus(job.id, step.key)}
                          disabled={updating}
                          style={{ padding: '6px 10px', borderRadius: 10, border: `2px solid ${isActive ? 'var(--primary)' : '#e0e0e0'}`, background: isActive ? '#e8f5e9' : '#fff', fontSize: 12, fontWeight: 700, color: isActive ? 'var(--primary)' : '#9e9e9e', cursor: 'pointer' }}>
                          {step.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ปุ่มบันทึกผล */}
              {job.status === 'confirmed' && (
                <div style={{ marginTop: 10 }}>
                  <UIButton fullWidth variant="secondary"
                    onClick={() => { setActiveJob(job); setYieldKg(String(job.planting_cycles?.estimated_yield_kg ?? '')); setShowResult(true); }}>
                    📝 บันทึกผลการเกี่ยว
                  </UIButton>
                </div>
              )}

              {/* ผลที่บันทึกแล้ว */}
              {job.status === 'completed' && job.actual_yield_kg && (
                <div style={{ borderTop: '1px solid #f0f4f0', paddingTop: 8, marginTop: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#2e7d32', fontWeight: 700 }}>
                    ✅ ผลผลิต: {job.actual_yield_kg.toLocaleString()} กก.
                    {job.quality_grade && ` · เกรด ${job.quality_grade}`}
                    {job.quality_moisture && ` · ความชื้น ${job.quality_moisture}%`}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Result modal */}
        {showResult && activeJob && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', padding: '0 0 16px' }}
            onClick={(e) => e.target === e.currentTarget && setShowResult(false)}>
            <div style={{ background: '#fff', borderRadius: '20px 20px 12px 12px', padding: '24px 20px', width: '100%', maxWidth: 480, margin: '0 auto', display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 17 }}>📝 บันทึกผลการเกี่ยว</p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
                {activeJob.planting_cycles?.plots?.name} · {activeJob.planting_cycles?.crop_name}
              </p>
              <label className="reg-label">ผลผลิตจริง (กก.)
                <input className="reg-input" type="number" value={yieldKg} onChange={(e) => setYieldKg(e.target.value)}
                  placeholder={`คาด ${activeJob.planting_cycles?.estimated_yield_kg ?? '—'} กก.`} />
              </label>
              <label className="reg-label">ความชื้น (%)
                <input className="reg-input" type="number" step="0.1" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="14.5" />
                {moisture && (
                  <span className="reg-hint" style={{ color: Number(moisture) <= 14.5 ? '#2e7d32' : Number(moisture) <= 18 ? '#e65100' : '#c62828', fontWeight: 700 }}>
                    เกรด: {Number(moisture) <= 14.5 ? 'A' : Number(moisture) <= 18 ? 'B' : Number(moisture) <= 25 ? 'C' : 'Reject'}
                  </span>
                )}
              </label>
              <label className="reg-label">หมายเหตุ
                <textarea className="reg-input reg-textarea" rows={2} value={resultNote} onChange={(e) => setResultNote(e.target.value)} placeholder="สภาพแปลง ปัญหา…" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <UIButton variant="ghost" onClick={() => setShowResult(false)}>ยกเลิก</UIButton>
                <UIButton onClick={() => saveResult(activeJob.id)} loading={updating}>💾 บันทึก</UIButton>
              </div>
            </div>
          </div>
        )}

      </div>
    </MobileAppShell>
  );
}
