'use client';

import { Suspense, type ChangeEvent, useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }               from '@/providers/auth-provider';
import { CompletenessReminder }           from '@/shared/components/completeness-reminder';
import { NoBurnStatsBanner }              from '@/features/no-burn-community/no-burn-stats-banner';
import { LoadingState }                   from '@/shared/components/loading-state';
import { ProtectedRoute }                 from '@/shared/components/protected-route';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type NoBurnRequest = {
  id:              string;
  status:          string;
  timing:          'before_planting' | 'after_planting' | null;
  submitted_at:    string;
  review_note:     string | null;
  note:            string | null;
  plots:           { name: string; province: string | null }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};

type Season = {
  id: string; name: string; season_year: number;
  starts_at: string; ends_at: string;
  bonus_type: 'per_ton' | 'per_rai'; bonus_value: number;
};

type Plot  = { id: string; name: string; province: string | null; area_rai?: number | null };
type Cycle = { id: string; crop_name: string; season_year: number; status: string };
type Timing = 'before_planting' | 'after_planting';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  submitted:           { bg: '#FAEEDA', border: '#854F0B', color: '#633806', label: '⏳ รอตรวจสอบ' },
  under_review:        { bg: '#E6F1FB', border: '#185FA5', color: '#0C447C', label: '🔍 กำลังตรวจสอบ' },
  inspection_required: { bg: '#EEEDFE', border: '#534AB7', color: '#3C3489', label: '📋 ต้องตรวจแปลง' },
  approved:            { bg: '#EAF3DE', border: '#3B6D11', color: '#27500A', label: '✅ อนุมัติแล้ว' },
  rejected:            { bg: '#F1EFE8', border: '#5F5E5A', color: '#444441', label: '⛔ ไม่ผ่าน' },
  completed:           { bg: '#EAF3DE', border: '#3B6D11', color: '#27500A', label: '🏁 เสร็จสิ้น' },
  anomaly:             { bg: '#FAEEDA', border: '#854F0B', color: '#633806', label: '⚠️ พบเหตุผิดปกติ' },
  seeking_support:     { bg: '#E6F1FB', border: '#185FA5', color: '#0C447C', label: '🤝 รับคำแนะนำ' },
};

const TIMING_CFG: Record<Timing, { icon: string; label: string; sub: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',     sub: 'ยังไม่ได้ปลูก — ตั้งใจงดเผาก่อนเริ่มรอบปลูก' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว', sub: 'ปลูกแล้ว — ขอร่วมโครงการในรอบที่ดำเนินอยู่' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: refreshed } = await sb.auth.refreshSession();
  if (refreshed.session?.access_token) return refreshed.session.access_token;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section label with step number dot */
function FieldLabel({ step, children, optional }: { step?: number; children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {step !== undefined && (
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: '#2e7d32',
          color: '#fff', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{step}</span>
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
        {children}
        {optional && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>(ไม่บังคับ)</span>}
      </span>
    </div>
  );
}

/** Timing picker card */
function TimingCard({ value, selected, onSelect, disabled }: {
  value: Timing; selected: boolean; onSelect: () => void; disabled?: boolean;
}) {
  const cfg = TIMING_CFG[value];
  return (
    <button type="button" onClick={onSelect} disabled={disabled}
      style={{
        flex: 1, padding: '14px 12px', borderRadius: 14, textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        border: `2px solid ${selected ? '#2e7d32' : '#e5e7eb'}`,
        background: selected ? '#f0fdf4' : '#fff',
        transition: 'border-color .15s, background .15s',
        WebkitTapHighlightColor: 'transparent',
      }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{cfg.icon}</div>
      <p style={{ margin: '0 0 3px', fontWeight: 800, fontSize: 13, color: selected ? '#2e7d32' : '#111', lineHeight: 1.2 }}>
        {cfg.label}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{cfg.sub}</p>
    </button>
  );
}

/** Photo thumbnail row */
function PhotoRow({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 10,
      background: '#f0fdf4', border: '1px solid #bbf7d0',
    }}>
      <span style={{ fontSize: 18 }}>📷</span>
      <span style={{ flex: 1, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </span>
      <button onClick={onRemove} disabled={disabled}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 2 }}>
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page content
// ─────────────────────────────────────────────────────────────────────────────
function NoBurnPageContent() {
  const member   = useCurrentMember();
  const searchParams = useSearchParams();
  const selectedPlotId = searchParams.get('plot_id') ?? '';
  const fileId   = useId();

  const [requests,  setRequests]  = useState<NoBurnRequest[]>([]);
  const [plots,     setPlots]     = useState<Plot[]>([]);
  const [cycles,    setCycles]    = useState<Cycle[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [seasons,   setSeasons]   = useState<Season[]>([]);

  const [showForm,       setShowForm]       = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedPlot,   setSelectedPlot]   = useState('');
  const [timing,         setTiming]         = useState<Timing>('after_planting');
  const [selectedCycle,  setSelectedCycle]  = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [formNote,       setFormNote]       = useState('');
  const [photoFiles,     setPhotoFiles]     = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // ดึง seasons ที่เปิดอยู่
    void fetch('/api/member/no-burn/seasons')
      .then(r => r.ok ? r.json() : { seasons: [] })
      .then((d: { seasons?: Season[] }) => {
        const list = d.seasons ?? [];
        setSeasons(list);
        if (list.length === 1) setSelectedSeason(list[0].id);
      });
    const token = await getBearerToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const requestParams = new URLSearchParams(member?.member_id ? { member_id: member.member_id } : {});
    const reqRes = await fetch(`/api/member/no-burn?${requestParams.toString()}`, { headers });
    if (reqRes.ok) {
      const j = (await reqRes.json()) as { requests?: NoBurnRequest[] };
      setRequests(j.requests ?? []);
    }
    const sb = tryCreateSupabaseBrowserClient();
    if (member?.member_id) {
      const plotParams = new URLSearchParams({ member_id: member.member_id });
      const plotPromise = fetch(`/api/member/plots?${plotParams.toString()}`, { headers })
        .then(async (r) => ({ ok: r.ok, payload: (await r.json()) as { plots?: Plot[]; error?: string } }));
      const cyclePromise = sb
        ? fetch(`/api/member/planting-cycles?member_id=${member.member_id}`, { headers })
          .then(r => r.ok ? r.json().then((j: { cycles?: Cycle[] }) =>
            ({ data: (j.cycles ?? []).filter(c => ['pending','active','confirmed','growing','flowering','maturing'].includes(c.status)), error: null }))
            : ({ data: [], error: null }))
        : Promise.resolve({ data: [] as Cycle[] });
      const [plotsRes, cyclesRes] = await Promise.all([plotPromise, cyclePromise]);
      if (!plotsRes.ok) setError(plotsRes.payload.error ?? 'ไม่สามารถโหลดแปลงได้');
      const loadedPlots = plotsRes.payload.plots ?? [];
      setPlots(loadedPlots);
      if (selectedPlotId && loadedPlots.some((plot) => plot.id === selectedPlotId)) {
        setSelectedPlot(selectedPlotId);
        setShowForm(true);
      }
      setCycles((cyclesRes.data ?? []) as Cycle[]);
    }
    setLoading(false);
  }, [member?.member_id]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setShowForm(false); setSelectedPlot(''); setTiming('after_planting');
    setSelectedCycle(''); setConsentChecked(false); setFormNote('');
    setPhotoFiles([]); setError(null); setSelectedSeason('');
  }

  function handleTimingChange(t: Timing) {
    setTiming(t);
    if (t === 'before_planting') setSelectedCycle('');
  }

  function onSelectPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 4));
    e.target.value = '';
  }

  async function submitRequest() {
    setError(null);
    if (!selectedPlot)   { setError('กรุณาเลือกแปลง'); return; }
    if (!consentChecked) { setError('กรุณายืนยันความยินยอมก่อนส่งคำขอ'); return; }
    setSubmitting(true);

    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    let gpsAcc: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }),
        );
        gpsLat = pos.coords.latitude; gpsLng = pos.coords.longitude; gpsAcc = pos.coords.accuracy;
      } catch { /* denied — proceed */ }
    }

    const token = await getBearerToken();
    const form  = new FormData();
    if (member?.member_id) form.append('member_id', member.member_id);
    form.append('plot_id', selectedPlot); form.append('consent_accepted', 'true'); form.append('timing', timing);
    if (selectedCycle)   form.append('planting_cycle_id', selectedCycle);
    if (selectedSeason)  form.append('season_id', selectedSeason);
    if (formNote.trim()) form.append('note', formNote.trim());
    if (gpsLat !== null) form.append('lat', String(gpsLat));
    if (gpsLng !== null) form.append('lng', String(gpsLng));
    if (gpsAcc !== null) form.append('accuracy', String(gpsAcc));
    photoFiles.forEach((file, i) => form.append(`photo_${i}`, file));

    const res  = await fetch('/api/member/no-burn', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
    const json = (await res.json()) as { ok?: boolean; request_id?: string; error?: string; photo_warnings?: string[] };
    setSubmitting(false);

    if (!res.ok || json.error) { setError(json.error ?? 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่'); return; }
    const w = json.photo_warnings?.length ? ` (รูปบางรูปอัปโหลดไม่สำเร็จ: ${json.photo_warnings.length} รูป)` : '';
    setNotice(`ยื่นคำของดเผาแล้ว รอเจ้าหน้าที่ตรวจสอบ${w}`);
    resetForm(); void load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 88px', maxWidth: 480, margin: '0 auto' }}>
      <CompletenessReminder />

      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)',
        borderRadius: 20, padding: '24px 20px 20px', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circle */}
        <div style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', right: 16, top: 16, width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <p style={{ margin: '0 0 4px', fontSize: 28 }}>🌿</p>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
          โครงการไม่เผา
        </h2>
        {seasons.length > 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            รับโบนัส{' '}
            <strong style={{ color: '#a5d6a7' }}>
              +{seasons[0].bonus_value.toLocaleString()} บาท/{seasons[0].bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}
            </strong>
            {' '}· {seasons[0].name}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            สมาชิกที่งดเผาตอซังรับโบนัสพิเศษ
          </p>
        )}
        <div style={{ marginTop: 14 }}>
          <NoBurnStatsBanner />
        </div>
      </div>

      {/* ── Toast: success ── */}
      {notice && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#EAF3DE', border: '1px solid #3B6D11', borderRadius: 12,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#27500A' }}>{notice}</p>
          </div>
          <button onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, flexShrink: 0, padding: 0 }}>✕</button>
        </div>
      )}

      {/* ── Toast: error ── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#FAEEDA', border: '1px solid #854F0B', borderRadius: 12,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#633806', flex: 1 }}>{error}</p>
          <button onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      )}

      {/* ── CTA gate: ต้องมีแปลง + รอบปลูกก่อน ── */}
      {!showForm && (
        <>
          {/* ยังไม่มีแปลง */}
          {plots.length === 0 && (
            <div style={{
              borderRadius: 16, overflow: 'hidden', marginBottom: 16,
              border: '1.5px solid #854F0B',
            }}>
              <div style={{ background: '#FAEEDA', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🗺️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 14, color: '#633806' }}>ขั้นตอนที่ 1 — เพิ่มแปลงเกษตร</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>
                    ต้องลงทะเบียนแปลงก่อนจึงจะสมัครโครงการงดเผาได้
                  </p>
                </div>
              </div>
              <a href="/plots/add" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', background: '#854F0B', color: '#fff',
                fontSize: 14, fontWeight: 800, textDecoration: 'none',
              }}>
                + เพิ่มแปลงเกษตร
              </a>
            </div>
          )}

          {/* มีแปลงแล้ว แต่ยังไม่มีรอบปลูก */}
          {plots.length > 0 && cycles.length === 0 && (
            <div style={{
              borderRadius: 16, overflow: 'hidden', marginBottom: 16,
              border: '1.5px solid #185FA5',
            }}>
              <div style={{ background: '#E6F1FB', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🌱</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 14, color: '#0C447C' }}>ขั้นตอนที่ 2 — เปิดรอบปลูก</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#185FA5', lineHeight: 1.5 }}>
                    แจ้งรอบปลูกที่กำลังดำเนินอยู่เพื่อใช้อ้างอิงในโครงการงดเผา
                  </p>
                </div>
              </div>
              <a href={`/planting-cycles/new${selectedPlot ? `?plot_id=${encodeURIComponent(selectedPlot)}` : ''}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', background: '#185FA5', color: '#fff',
                fontSize: 14, fontWeight: 800, textDecoration: 'none',
              }}>
                + เปิดรอบปลูกใหม่
              </a>
            </div>
          )}

          {/* ครบทั้ง 2 ขั้น — ยื่นได้ */}
          {plots.length > 0 && (
            <button
              onClick={() => { setShowForm(true); setError(null); setNotice(null); }}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: '#2e7d32', color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 20, WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 18 }}>+</span> ยื่นคำของดเผาใหม่
            </button>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FORM
          ═══════════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb',
          overflow: 'hidden', marginBottom: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Form header */}
          <div style={{
            padding: '16px 20px 14px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#111' }}>คำของดเผา</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>กรอกข้อมูลแปลงที่ต้องการงดเผา</p>
            </div>
            <button onClick={resetForm}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
              ✕
            </button>
          </div>

          <div style={{ padding: '20px' }}>

            {/* ── Step 1: แปลง ── */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel step={1}>แปลงที่ต้องการงดเผา</FieldLabel>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedPlot}
                  onChange={(e) => setSelectedPlot(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '12px 40px 12px 14px', borderRadius: 12,
                    border: `1.5px solid ${selectedPlot ? '#2e7d32' : '#d1d5db'}`,
                    background: '#fff', fontSize: 14, color: selectedPlot ? '#111' : '#9ca3af',
                    appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color .15s',
                  }}>
                  <option value="">เลือกแปลง…</option>
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.province ? ` · ${p.province}` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', fontSize: 12 }}>▾</span>
              </div>

            </div>

            {/* ── Step 1.5: Season ── */}
            {seasons.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <FieldLabel step={2}>รอบโครงการที่เข้าร่วม</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}
                    disabled={submitting}
                    style={{ width:'100%', padding:'12px 40px 12px 14px', borderRadius:12,
                      border:`1.5px solid ${selectedSeason ? '#2e7d32' : '#d1d5db'}`,
                      background:'#fff', fontSize:14, appearance:'none', WebkitAppearance:'none',
                      cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
                    <option value="">เลือกรอบโครงการ…</option>
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — โบนัส {s.bonus_value} บาท/{s.bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}
                      </option>
                    ))}
                  </select>
                  <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#6b7280', fontSize:12 }}>▾</span>
                </div>

                {/* ROI panel */}
                {selectedSeason && (() => {
                  const s = seasons.find((x) => x.id === selectedSeason);
                  const plot = plots.find((p) => p.id === selectedPlot);
                  if (!s) return null;
                  const areaRai = (plot as { area_rai?: number | null } | undefined)?.area_rai ?? null;
                  const bonusEst = s.bonus_type === 'per_rai' && areaRai
                    ? s.bonus_value * areaRai
                    : null;
                  return (
                    <div style={{ marginTop:10, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 14px', display:'grid', gap:8 }}>
                      <p style={{ margin:0, fontWeight:700, fontSize:13, color:'#14532d' }}>
                        💰 ประโยชน์ที่คุณจะได้รับ
                      </p>
                      <div style={{ display:'grid', gap:6 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span style={{ color:'#374151' }}>
                            🌿 โบนัสไม่เผา ({s.bonus_type === 'per_ton' ? 'บาท/ตัน' : 'บาท/ไร่'})
                          </span>
                          <span style={{ fontWeight:700, color:'#14532d' }}>
                            {bonusEst != null
                              ? `+${bonusEst.toLocaleString()} บาท`
                              : `+${s.bonus_value} บาท/${s.bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}`}
                          </span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span style={{ color:'#374151' }}>🪱 ปุ๋ยจากอินทรียวัตถุในดิน</span>
                          <span style={{ fontWeight:700, color:'#14532d' }}>
                            {areaRai ? `~${Math.round(areaRai * 200)}–${Math.round(areaRai * 500)} บาท` : 'ประหยัดปุ๋ย'}
                          </span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span style={{ color:'#374151' }}>💧 ดินอุ้มน้ำดีขึ้น</span>
                          <span style={{ fontWeight:600, color:'#059669' }}>ลดค่าน้ำ/แรงงาน</span>
                        </div>
                      </div>
                      {s.bonus_type === 'per_ton' && (
                        <p style={{ margin:0, fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
                          ⚖️ โบนัสบาท/ตัน คำนวณอัตโนมัติเมื่อชั่งน้ำหนักขายจริง — ยิ่งขายมาก ยิ่งได้มาก
                        </p>
                      )}
                      {s.bonus_type === 'per_rai' && bonusEst != null && (
                        <p style={{ margin:0, fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
                          🗺️ โบนัส {s.bonus_value} บาท × {areaRai} ไร่ = {bonusEst.toLocaleString()} บาท — ได้ทันทีที่ตรวจผ่าน
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Step 3: Timing (renumbered) ── */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel step={seasons.length > 0 ? 3 : 2}>จะงดเผาตอนไหน?</FieldLabel>
              <div style={{ display: 'flex', gap: 10 }}>
                <TimingCard value="before_planting" selected={timing === 'before_planting'} onSelect={() => handleTimingChange('before_planting')} disabled={submitting} />
                <TimingCard value="after_planting"  selected={timing === 'after_planting'}  onSelect={() => handleTimingChange('after_planting')}  disabled={submitting} />
              </div>
            </div>

            {/* ── Planting cycle (after only) ── */}
            {timing === 'after_planting' && cycles.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <FieldLabel optional>รอบเพาะปลูก</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedCycle}
                    onChange={(e) => setSelectedCycle(e.target.value)}
                    disabled={submitting}
                    style={{
                      width: '100%', padding: '12px 40px 12px 14px', borderRadius: 12,
                      border: `1.5px solid ${selectedCycle ? '#2e7d32' : '#d1d5db'}`,
                      background: '#fff', fontSize: 14, appearance: 'none', WebkitAppearance: 'none',
                      cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
                    }}>
                    <option value="">ไม่ระบุ</option>
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>{c.crop_name} ปี {c.season_year} · {c.status === 'active' || c.status === 'confirmed' || c.status === 'growing' ? 'กำลังปลูก' : c.status}</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', fontSize: 12 }}>▾</span>
                </div>
              </div>
            )}

            {/* ── Note ── */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel optional>หมายเหตุ</FieldLabel>
              <textarea
                rows={2}
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                disabled={submitting}
                placeholder="เช่น ช่วงเวลาที่ตั้งใจงดเผา วิธีจัดการตอซัง…"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  border: '1.5px solid #d1d5db', background: '#fff',
                  fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
                  lineHeight: 1.6, boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#2e7d32'; }}
                onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; }}
              />
            </div>

            {/* ── Photos ── */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel optional>แนบรูปหลักฐาน</FieldLabel>
              <p style={{ margin: '-4px 0 8px', fontSize: 11, color: '#9ca3af' }}>สูงสุด 4 รูป</p>

              {photoFiles.length < 4 && (
                <label htmlFor={fileId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px', borderRadius: 12,
                  border: '1.5px dashed #d1d5db', background: '#fafafa',
                  cursor: submitting ? 'default' : 'pointer', fontSize: 13, color: '#6b7280',
                  fontWeight: 600,
                }}>
                  <span style={{ fontSize: 18 }}>📷</span> เลือกรูปจากกล้องหรือแกลเลอรี่
                  <input id={fileId} type="file" accept="image/*" capture="environment" multiple
                    onChange={onSelectPhotos} disabled={submitting}
                    style={{ display: 'none' }} />
                </label>
              )}

              {photoFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {photoFiles.map((file, i) => (
                    <PhotoRow key={`${file.name}-${i}`} file={file} onRemove={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))} disabled={submitting} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Consent ── */}
            <label style={{
              display: 'flex', gap: 12, cursor: 'pointer',
              padding: '14px', borderRadius: 12, marginBottom: 20,
              background: consentChecked ? '#f0fdf4' : '#f9fafb',
              border: `1.5px solid ${consentChecked ? '#2e7d32' : '#e5e7eb'}`,
              transition: 'background .15s, border-color .15s',
            }}>
              {/* custom checkbox */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: consentChecked ? '#2e7d32' : '#fff',
                border: `2px solid ${consentChecked ? '#2e7d32' : '#d1d5db'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, border-color .15s',
              }}>
                {consentChecked && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
              </div>
              <input type="checkbox" checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                disabled={submitting} style={{ display: 'none' }} />
              <span style={{ fontSize: 13, lineHeight: 1.65, color: '#374151' }}>
                ฉันยืนยันว่าจะ<strong style={{ color: '#2e7d32' }}>ไม่เผา</strong>ในแปลงและพื้นที่ใกล้เคียง
                และยินยอมให้เจ้าหน้าที่เข้าตรวจสอบหลักฐานในแปลงได้
              </span>
            </label>

            {/* ── Error inline ── */}
            {error && (
              <p style={{ margin: '-12px 0 12px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠️ {error}</p>
            )}

            {/* ── Submit button ── */}
            <button
              onClick={submitRequest}
              disabled={submitting || !selectedPlot || !consentChecked}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                background: (!selectedPlot || !consentChecked) ? '#e5e7eb' : '#2e7d32',
                color:      (!selectedPlot || !consentChecked) ? '#9ca3af' : '#fff',
                transition: 'background .2s, color .2s',
                letterSpacing: '0.01em',
              }}>
              {submitting ? '⏳ กำลังส่ง…' : '🌿 ส่งคำของดเผา'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MY REQUESTS
          ═══════════════════════════════════════════════════════════════════════ */}
      {requests.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#111' }}>
            คำขอของฉัน
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map((req) => {
              const st       = STATUS_CFG[req.status] ?? STATUS_CFG.rejected;
              const plotName = req.plots?.[0]?.name ?? '—';
              const province = req.plots?.[0]?.province;
              const crop     = req.planting_cycles?.[0];
              const timingCfg = req.timing ? TIMING_CFG[req.timing] : null;

              return (
                <div key={req.id} style={{
                  background: st.bg, borderRadius: 16,
                  border: `1px solid ${st.border}44`,
                  overflow: 'hidden',
                }}>
                  {/* status bar */}
                  <div style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${st.border}22`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: st.color }}>{st.label}</span>
                    <span style={{ fontSize: 11, color: st.color, opacity: 0.7 }}>
                      {new Date(req.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* body */}
                  <div style={{ padding: '12px 16px' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: '#111' }}>
                      {plotName}{province ? <span style={{ fontWeight: 400, fontSize: 13, color: '#6b7280' }}> · {province}</span> : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {timingCfg && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#fff', color: st.color, border: `1px solid ${st.border}55` }}>
                          {timingCfg.icon} {timingCfg.label}
                        </span>
                      )}
                      {crop && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#fff', color: '#374151', border: '1px solid #e5e7eb' }}>
                          🌾 {crop.crop_name} {crop.season_year}
                        </span>
                      )}
                    </div>
                    {req.note && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>📝 {req.note}</p>
                    )}
                    {req.review_note && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff', borderRadius: 8, border: `1px solid ${st.border}33` }}>
                        <p style={{ margin: 0, fontSize: 12, color: st.color, fontWeight: 600 }}>
                          💬 หมายเหตุเจ้าหน้าที่: <span style={{ fontWeight: 400, color: '#374151' }}>{req.review_note}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!showForm && requests.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
          <p style={{ margin: 0, fontSize: 14 }}>ยังไม่มีคำของดเผา</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NoBurnPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <Suspense fallback={<LoadingState label="กำลังโหลด…" />}>
        <NoBurnPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
