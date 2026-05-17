'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type NoBurnRequest = {
  id: string; status: string; submitted_at: string; review_note: string | null;
  plots: { name: string }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};
type Plot = { id: string; name: string; province: string | null };
type Cycle = { id: string; crop_name: string; season_year: number; status: string };

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  submitted:  { bg: '#fff8e1', color: '#e65100', label: '⏳ รอตรวจสอบ' },
  inspecting: { bg: '#e3f2fd', color: '#1565c0', label: '🔍 กำลังตรวจ' },
  approved:   { bg: '#e8f5e9', color: '#2e7d32', label: '✅ อนุมัติ' },
  rejected:   { bg: '#ffebee', color: '#c62828', label: '❌ ไม่อนุมัติ' },
};

export default function NoBurnPage() {
  const member = useCurrentMember();
  const [requests, setRequests] = useState<NoBurnRequest[]>([]);
  const [plots, setPlots]       = useState<Plot[]>([]);
  const [cycles, setCycles]     = useState<Cycle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // form state
  const [selectedPlot,  setSelectedPlot]  = useState('');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [formNote,      setFormNote]      = useState('');

  async function load() {
    if (!member?.member_id) return;
    const s = createSupabaseBrowserClient();
    const [rRes, pRes, cRes] = await Promise.all([
      s.from('no_burn_requests')
        .select('id,status,submitted_at,review_note,plots(name),planting_cycles(crop_name,season_year)')
        .eq('member_id', member.member_id)
        .order('submitted_at', { ascending: false }),
      s.from('plots').select('id,name,province')
        .eq('member_id', member.member_id).is('deleted_at', null),
      s.from('planting_cycles').select('id,crop_name,season_year,status')
        .eq('member_id', member.member_id)
        .not('status', 'in', '("harvested","cancelled")'),
    ]);
    setRequests((rRes.data as NoBurnRequest[]) ?? []);
    setPlots((pRes.data as Plot[]) ?? []);
    setCycles((cRes.data as Cycle[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  async function submitRequest() {
    if (!selectedPlot || !member?.member_id) {
      setError('กรุณาเลือกแปลงที่ต้องการงดเผา'); return;
    }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { error: e } = await s.from('no_burn_requests').insert({
      member_id:         member.member_id,
      plot_id:           selectedPlot,
      planting_cycle_id: selectedCycle || null,
      status:            'submitted',
    });
    setSubmitting(false);
    if (e) { setError(e.message); return; }
    setNotice('✅ ยื่นคำของดเผาแล้ว รอเจ้าหน้าที่ตรวจสอบ');
    setShowForm(false);
    setSelectedPlot(''); setSelectedCycle(''); setFormNote('');
    await load();
  }

  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <MobileAppShell title="งดเผา" subtitle="ยื่นคำขอและดูสถานะการอนุมัติ">
      <div className="mobile-stack">

        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}

        {/* info card */}
        <div className="kaona-card" style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1b5e20' }}>🌿 ทำไมต้องงดเผา?</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4a6741', lineHeight: 1.7 }}>
            การงดเผาตอซังช่วยรักษาหน้าดิน เพิ่มอินทรียวัตถุ และลดมลพิษทางอากาศ
            สมาชิกที่ได้รับอนุมัติจะได้รับสิทธิ์พิเศษในการสั่งซื้อเมล็ดพันธุ์
          </p>
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}

        {/* form */}
        {showForm && (
          <div className="kaona-card">
            <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 15 }}>📝 ยื่นคำของดเผาใหม่</p>

            {error && (
              <div style={{ background: '#ffebee', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#c62828', marginBottom: 10 }}>
                ⚠️ {error}
              </div>
            )}

            <label className="reg-label">เลือกแปลง <span className="reg-required">*</span>
              <select className="reg-input" value={selectedPlot} onChange={(e) => setSelectedPlot(e.target.value)}>
                <option value="">— เลือกแปลง —</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.province ? ` (${p.province})` : ''}
                  </option>
                ))}
              </select>
              {plots.length === 0 && (
                <span className="reg-hint">
                  ยังไม่มีแปลง — <a href="/plots/add" style={{ color: 'var(--primary)' }}>เพิ่มแปลงก่อน</a>
                </span>
              )}
            </label>

            <label className="reg-label">รอบเพาะปลูก (ถ้ามี)
              <select className="reg-input" value={selectedCycle} onChange={(e) => setSelectedCycle(e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.crop_name} ปี {c.season_year}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <UIButton variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>
                ยกเลิก
              </UIButton>
              <UIButton onClick={submitRequest} loading={submitting} disabled={!selectedPlot || submitting}>
                ✅ ยืนยัน
              </UIButton>
            </div>
          </div>
        )}

        {/* history */}
        {!loading && requests.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48 }}>🌾</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0' }}>
              ยังไม่มีคำของดเผา
            </p>
          </div>
        )}

        {requests.map((req) => {
          const st = STATUS_COLOR[req.status] ?? { bg: '#f5f5f5', color: '#666', label: req.status };
          return (
            <div key={req.id} className="kaona-card"
              style={{ background: st.bg, borderColor: st.color + '66' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                    {req.plots?.[0]?.name ?? 'แปลงไม่ระบุ'}
                  </p>
                  {req.planting_cycles?.[0] && (
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                      🌱 {req.planting_cycles[0].crop_name} ปี {req.planting_cycles[0].season_year}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    ยื่นเมื่อ {new Date(req.submitted_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                  {req.review_note && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: st.color }}>
                      📝 {req.review_note}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}

        {!showForm && (
          <UIButton fullWidth variant="secondary" onClick={() => setShowForm(true)}>
            + ยื่นคำของดเผาใหม่
          </UIButton>
        )}

      </div>
    </MobileAppShell>
    </ProtectedRoute>
  );
}