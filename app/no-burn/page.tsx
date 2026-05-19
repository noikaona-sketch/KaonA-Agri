'use client';

import { type ChangeEvent, useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { CompletenessReminder }   from '@/shared/components/completeness-reminder';
import { NoBurnStatsBanner }      from '@/features/no-burn-community/no-burn-stats-banner';
import { LoadingState }         from '@/shared/components/loading-state';
import { ProtectedRoute }       from '@/shared/components/protected-route';
import { UIButton }             from '@/shared/components/ui-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type NoBurnRequest = {
  id:           string;
  status:       string;
  submitted_at: string;
  review_note:  string | null;
  note:         string | null;
  plots:        { name: string; province: string | null }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};

type Plot  = { id: string; name: string; province: string | null };
type Cycle = { id: string; crop_name: string; season_year: number; status: string };

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  submitted:            { bg: '#fff8e1', color: '#e65100', label: '⏳ รอตรวจสอบ' },
  under_review:         { bg: '#e3f2fd', color: '#1565c0', label: '🔍 กำลังตรวจสอบ' },
  inspection_required:  { bg: '#fce4ec', color: '#880e4f', label: '📋 ต้องตรวจแปลง' },
  approved:             { bg: '#e8f5e9', color: '#2e7d32', label: '✅ อนุมัติแล้ว' },
  rejected:             { bg: '#fafafa', color: '#9e9e9e', label: '⛔ ไม่ผ่าน' },
  completed:            { bg: '#e8f5e9', color: '#2e7d32', label: '🏁 เสร็จสิ้น' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Bearer token from Supabase session
// ─────────────────────────────────────────────────────────────────────────────
async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
function NoBurnPageContent() {
  const member = useCurrentMember();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<NoBurnRequest[]>([]);
  const [plots,    setPlots]    = useState<Plot[]>([]);
  const [cycles,   setCycles]   = useState<Cycle[]>([]);
  const [loading,  setLoading]  = useState(true);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [showForm,       setShowForm]       = useState(false);
  const [selectedPlot,   setSelectedPlot]   = useState('');
  const [selectedCycle,  setSelectedCycle]  = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [formNote,       setFormNote]       = useState('');
  const [photoFiles,     setPhotoFiles]     = useState<File[]>([]);

  // ── Submit state ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Load existing requests + available plots/cycles ─────────────────────────
  async function load() {
    setLoading(true);
    const token = await getBearerToken();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    // Own requests via new API (session-based)
    const reqRes = await fetch('/api/member/no-burn', { headers });
    if (reqRes.ok) {
      const j = (await reqRes.json()) as { requests?: NoBurnRequest[] };
      setRequests(j.requests ?? []);
    }

    // Plots and cycles still loaded via browser Supabase client (read-only, no auth issue)
    const sb = tryCreateSupabaseBrowserClient();
    if (sb && member?.member_id) {
      const [plotsRes, cyclesRes] = await Promise.all([
        sb.from('plots').select('id,name,province').eq('member_id', member.member_id).is('deleted_at', null),
        sb.from('planting_cycles').select('id,crop_name,season_year,status')
          .eq('member_id', member.member_id)
          .not('status', 'in', '("harvested","cancelled")'),
      ]);
      setPlots((plotsRes.data ?? []) as Plot[]);
      setCycles((cyclesRes.data ?? []) as Cycle[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  // ── Photo handling ──────────────────────────────────────────────────────────
  function onSelectPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 4));
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit via API route (member_id resolved server-side) ───────────────────
  async function submitRequest() {
    setError(null);
    if (!selectedPlot) { setError('กรุณาเลือกแปลง'); return; }
    if (!consentChecked) { setError('กรุณายืนยันความยินยอมก่อนส่งคำขอ'); return; }

    setSubmitting(true);

    // Capture GPS once at submit time — best-effort, non-blocking.
    // If geolocation is unavailable or denied the request still submits;
    // lat/lng/accuracy are simply omitted from the FormData.
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    let gpsAcc: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout:            10000,
            maximumAge:         0,
          }),
        );
        gpsLat = pos.coords.latitude;
        gpsLng = pos.coords.longitude;
        gpsAcc = pos.coords.accuracy;
      } catch {
        // Denied or timed-out — proceed without GPS
      }
    }

    const token = await getBearerToken();
    const form  = new FormData();
    form.append('plot_id',          selectedPlot);
    form.append('consent_accepted', 'true');
    if (selectedCycle)    form.append('planting_cycle_id', selectedCycle);
    if (formNote.trim())  form.append('note',              formNote.trim());
    if (gpsLat !== null)  form.append('lat',               String(gpsLat));
    if (gpsLng !== null)  form.append('lng',               String(gpsLng));
    if (gpsAcc !== null)  form.append('accuracy',          String(gpsAcc));
    photoFiles.forEach((file, i) => form.append(`photo_${i}`, file));

    const res = await fetch('/api/member/no-burn', {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    form,
      // No Content-Type — browser sets multipart boundary automatically
    });

    const json = (await res.json()) as {
      ok?:             boolean;
      request_id?:     string;
      error?:          string;
      photo_warnings?: string[];
    };

    setSubmitting(false);

    if (!res.ok || json.error) {
      setError(json.error ?? 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
      return;
    }

    // Success
    const warnSuffix = json.photo_warnings?.length
      ? ` (รูปบางรูปอัปโหลดไม่สำเร็จ: ${json.photo_warnings.length} รูป)`
      : '';
    setNotice(`✅ ยื่นคำของดเผาแล้ว รอเจ้าหน้าที่ตรวจสอบ${warnSuffix}`);
    setShowForm(false);
    setSelectedPlot('');
    setSelectedCycle('');
    setConsentChecked(false);
    setFormNote('');
    setPhotoFiles([]);
    void load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 480, margin: '0 auto' }}>

      <CompletenessReminder />
      <NoBurnStatsBanner />

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>🔥 งดเผา</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
          ยื่นคำขอเข้าร่วมโครงการงดเผาในไร่นา
        </p>
      </div>

      {/* Notice / error */}
      {notice && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 10, padding: '12px 14px', marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 13 }}>{notice}</p>
          <button
            style={{ marginTop: 6, fontSize: 12, color: '#1565c0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setNotice(null)}
          >
            ปิด
          </button>
        </div>
      )}
      {error && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: 10, padding: '12px 14px', marginBottom: 12,
          color: '#856404', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* CTA button */}
      {!showForm && (
        <UIButton fullWidth onClick={() => { setShowForm(true); setError(null); setNotice(null); }}>
          + ยื่นคำของดเผาใหม่
        </UIButton>
      )}

      {/* ── Submission form ── */}
      {showForm && (
        <div className="kaona-card" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>คำของดเผา</h3>

          {/* Plot selector */}
          <label>
            แปลงที่ต้องการงดเผา <span style={{ color: '#e53e3e' }}>*</span>
            <select
              value={selectedPlot}
              onChange={(e) => setSelectedPlot(e.target.value)}
              disabled={submitting}
            >
              <option value="">เลือกแปลง</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.province ? ` (${p.province})` : ''}
                </option>
              ))}
            </select>
          </label>
          {plots.length === 0 && (
            <p style={{ fontSize: 12, color: '#e65100', margin: '-6px 0 8px' }}>
              ⚠️ ยังไม่มีแปลงที่ลงทะเบียน —{' '}
              <a href="/plots/add" style={{ color: '#1565c0' }}>เพิ่มแปลงก่อน</a>
            </p>
          )}

          {/* Planting cycle (optional) */}
          {cycles.length > 0 && (
            <label>
              รอบเพาะปลูก (ถ้ามี)
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                disabled={submitting}
              >
                <option value="">ไม่ระบุ</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.crop_name} {c.season_year}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Note */}
          <label>
            หมายเหตุเพิ่มเติม
            <textarea
              rows={3}
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              disabled={submitting}
              placeholder="เช่น ช่วงเวลาที่ตั้งใจงดเผา วิธีจัดการตอซัง"
            />
          </label>

          {/* Photo attachment */}
          <label style={{ display: 'block', marginBottom: 4 }}>
            แนบรูปหลักฐาน <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>(ไม่บังคับ · สูงสุด 4 รูป)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={onSelectPhotos}
            disabled={submitting || photoFiles.length >= 4}
          />
          {photoFiles.map((file, i) => (
            <div key={`${file.name}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}
            >
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📷 {file.name}
              </span>
              <UIButton type="button" onClick={() => removePhoto(i)} disabled={submitting}>
                ลบ
              </UIButton>
            </div>
          ))}

          {/* Consent checkbox — required */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              disabled={submitting}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, lineHeight: 1.6 }}>
              ฉันยืนยันว่าจะ<strong>ไม่เผา</strong>ในแปลงและพื้นที่ใกล้เคียง
              และยินยอมให้เจ้าหน้าที่เข้าตรวจสอบหลักฐานในแปลงได้
            </span>
          </label>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <UIButton
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              disabled={submitting}
            >
              ยกเลิก
            </UIButton>
            <UIButton
              fullWidth
              type="button"
              onClick={submitRequest}
              disabled={submitting || !selectedPlot || !consentChecked}
              loading={submitting}
            >
              {submitting ? 'กำลังส่ง…' : 'ส่งคำของดเผา'}
            </UIButton>
          </div>
        </div>
      )}

      {/* ── My pending requests list ── */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>คำขอของฉัน</h3>

        {requests.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ยังไม่มีคำของดเผา</p>
        )}

        {requests.map((req) => {
          const st  = STATUS_STYLE[req.status] ?? { bg: '#f5f5f5', color: '#666', label: req.status };
          const plotName  = req.plots?.[0]?.name  ?? '—';
          const cropLabel = req.planting_cycles?.[0]
            ? `${req.planting_cycles[0].crop_name} ${req.planting_cycles[0].season_year}`
            : null;
          return (
            <div key={req.id} className="kaona-card" style={{ background: st.bg, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>แปลง: {plotName}</p>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 9px',
                  borderRadius: 999, background: st.color + '22', color: st.color,
                  whiteSpace: 'nowrap',
                }}>
                  {st.label}
                </span>
              </div>
              {cropLabel && (
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  🌾 {cropLabel}
                </p>
              )}
              <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                📅 ยื่นเมื่อ {new Date(req.submitted_at).toLocaleDateString('th-TH', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
              {req.note && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  📝 {req.note}
                </p>
              )}
              {req.review_note && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1565c0', background: '#e3f2fd', borderRadius: 6, padding: '6px 10px' }}>
                  💬 หมายเหตุเจ้าหน้าที่: {req.review_note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export with ProtectedRoute wrapper
// ─────────────────────────────────────────────────────────────────────────────
export default function NoBurnPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <NoBurnPageContent />
    </ProtectedRoute>
  );
}
