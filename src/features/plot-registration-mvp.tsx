'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader }  from '@/shared/components/section-header';
import { UIButton }       from '@/shared/components/ui-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type GeoLocation = {
  latitude:  number;
  longitude: number;
  accuracy:  number;
  capturedAt: string;
};

type Step = 'details' | 'photos' | 'review';

type PlotRow = {
  id:            string;
  name:          string;
  area_rai:      number;
  accuracy:      number | null;
  status:        string;
  province:      string | null;
  land_doc_type: string | null;
  lat:           number | null;
  lng:           number | null;
  created_at:    string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get Bearer token from current Supabase browser session
// ─────────────────────────────────────────────────────────────────────────────
async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

const STATUS_TH: Record<string, string> = {
  pending_review: 'รอตรวจสอบ',
  active:         'ใช้งาน',
  inactive:       'ไม่ใช้งาน',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function PlotRegistrationMVP() {
  const member        = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  // ── Flow state ──────────────────────────────────────────────────────────────
  const [step,          setStep]         = useState<Step>('details');
  const [plotName,      setPlotName]     = useState('');
  const [areaRai,       setAreaRai]      = useState('');
  const [plotNote,      setPlotNote]     = useState('');
  const [geo,           setGeo]          = useState<GeoLocation | null>(null);
  const [photoFiles,    setPhotoFiles]   = useState<File[]>([]);
  const [capturingGeo,  setCapturingGeo] = useState(false);
  const [submitting,    setSubmitting]   = useState(false);
  const [error,         setError]        = useState<string | null>(null);
  const [successPlotId, setSuccessPlotId]= useState<string | null>(null);

  // Edit mode: reopen a pending_review draft
  // When editingPlotId is set, form edits existing row via PATCH.
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);

  // ── My plots list ───────────────────────────────────────────────────────────
  const [plots,       setPlots]      = useState<PlotRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]  = useState<string | null>(null);

  // ── Validation ──────────────────────────────────────────────────────────────
  const areaValue    = Number(areaRai);
  const detailsValid = plotName.trim().length > 0 && Number.isFinite(areaValue) && areaValue > 0;
  const canSubmit    = useMemo(
    () => detailsValid && geo !== null && photoFiles.length > 0,
    [detailsValid, geo, photoFiles.length],
  );

  // ── Photo selection ─────────────────────────────────────────────────────────
  function onSelectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 4));
    // reset input so same file can be re-added after remove
    event.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── GPS capture ─────────────────────────────────────────────────────────────
  function captureGPS() {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง GPS');
      return;
    }
    setCapturingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude:   position.coords.latitude,
          longitude:  position.coords.longitude,
          accuracy:   position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setCapturingGeo(false);
      },
      (geoError) => {
        setError(geoError.message || 'ไม่สามารถจับพิกัด GPS ได้ กรุณาลองใหม่');
        setCapturingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // ── Load my plots ───────────────────────────────────────────────────────────
  const loadPlots = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const token = await getBearerToken();
      const res = await fetch('/api/member/plots', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        setListError('กรุณาเข้าสู่ระบบเพื่อดูรายการแปลง');
        setLoadingList(false);
        return;
      }
      const json = (await res.json()) as { plots?: PlotRow[]; error?: string };
      if (!res.ok || json.error) {
        setListError(json.error ?? 'โหลดรายการแปลงไม่สำเร็จ');
      } else {
        setPlots(json.plots ?? []);
      }
    } catch {
      setListError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    setLoadingList(false);
  }, []);

  useEffect(() => { void loadPlots(); }, [loadPlots]);

  // ── Submit to real API ──────────────────────────────────────────────────────
  async function submitPlot() {
    setError(null);
    setSuccessPlotId(null);

    // Guard: member must be approved (UI-level check before calling API)
    if (!member?.is_approved || member.status !== 'approved') {
      setError('เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้นที่ลงทะเบียนแปลงได้');
      return;
    }
    if (!geo) { setError('กรุณากดจับพิกัด GPS ก่อนส่งข้อมูล'); return; }
    if (photoFiles.length === 0) { setError('กรุณาแนบรูปแปลงอย่างน้อย 1 รูป'); return; }

    setSubmitting(true);

    try {
      const token = await getBearerToken();

      if (editingPlotId) {
        // ── PATCH: update existing pending_review draft ──────────────────────
        const res = await fetch('/api/member/plot-registration', {
          method:  'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            plot_id:     editingPlotId,
            name:        plotName.trim(),
            area_rai:    areaValue,
            lat:         geo.latitude,
            lng:         geo.longitude,
            accuracy:    geo.accuracy,
            description: plotNote.trim() || null,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || json.error) {
          setError(json.error ?? 'แก้ไขไม่สำเร็จ กรุณาลองใหม่');
          setSubmitting(false);
          return;
        }
        setEditingPlotId(null);
        setSuccessPlotId(editingPlotId);
      } else {
        // ── POST: create new plot ─────────────────────────────────────────────
        const form = new FormData();
        form.append('name',        plotName.trim());
        form.append('area_rai',    String(areaValue));
        form.append('lat',         String(geo.latitude));
        form.append('lng',         String(geo.longitude));
        form.append('accuracy',    String(geo.accuracy));
        if (plotNote.trim()) form.append('description', plotNote.trim());
        photoFiles.forEach((file, i) => form.append(`photo_${i}`, file));

        const res = await fetch('/api/member/plot-registration', {
          method:  'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    form,
          // Do NOT set Content-Type — browser sets multipart boundary automatically
        });
        const json = (await res.json()) as {
          ok?:             boolean;
          plot_id?:        string;
          error?:          string;
          photo_warnings?: string[];
        };
        if (!res.ok || json.error) {
          setError(json.error ?? 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่');
          setSubmitting(false);
          return;
        }
        setSuccessPlotId(json.plot_id ?? null);
      }

      // Success — reset form and refresh list
      setStep('details');
      setPlotName('');
      setAreaRai('');
      setPlotNote('');
      setGeo(null);
      setPhotoFiles([]);
      void loadPlots();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }

    setSubmitting(false);
  }

  // ── Open a pending_review plot for editing ───────────────────────────────
  function reopenDraft(plot: PlotRow) {
    setEditingPlotId(plot.id);
    setPlotName(plot.name);
    setAreaRai(String(plot.area_rai));
    setPlotNote('');  // description not in list payload — leave blank to preserve existing
    setGeo(
      plot.lat !== null && plot.lng !== null
        ? { latitude: plot.lat, longitude: plot.lng, accuracy: plot.accuracy ?? 0, capturedAt: '' }
        : null,
    );
    setPhotoFiles([]);
    setError(null);
    setSuccessPlotId(null);
    setStep('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingPlotId(null);
    setPlotName('');
    setAreaRai('');
    setPlotNote('');
    setGeo(null);
    setPhotoFiles([]);
    setError(null);
    setStep('details');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <MobileAppShell
      title={editingPlotId ? 'แก้ไขแปลง' : 'ลงทะเบียนแปลงเกษตร'}
      subtitle="รายละเอียดแปลง → แนบรูป → ตรวจทาน → บันทึก"
      roleBadge={effectiveRole ?? 'farmer'}
    >
      <SectionHeader
        title={editingPlotId ? 'แก้ไขแปลงที่รอตรวจสอบ' : 'ขั้นตอนลงทะเบียน'}
        subtitle="รายละเอียดแปลง → แนบรูป → ตรวจทาน → บันทึก"
      />
      {editingPlotId && (
        <div style={{ marginBottom: 8 }}>
          <UIButton type="button" onClick={cancelEdit} disabled={submitting}>
            ← ยกเลิกการแก้ไข
          </UIButton>
        </div>
      )}

      {/* ── Step: details ── */}
      {step === 'details' && (
        <section className="kaona-card">
          <h3>1) รายละเอียดแปลง</h3>
          <label>
            ชื่อแปลง <span style={{ color: 'var(--color-error, red)' }}>*</span>
            <input
              value={plotName}
              onChange={(e) => setPlotName(e.target.value)}
              disabled={submitting}
              placeholder="เช่น แปลงนาบ้านหนองบัว"
            />
          </label>
          <label>
            พื้นที่ (ไร่) <span style={{ color: 'var(--color-error, red)' }}>*</span>
            <input
              type="number" inputMode="decimal" min="0" step="0.25"
              value={areaRai}
              onChange={(e) => setAreaRai(e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </label>
          <label>
            รายละเอียดเพิ่มเติม
            <textarea
              value={plotNote}
              onChange={(e) => setPlotNote(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="เช่น จุดสังเกต ลักษณะพื้นที่"
            />
          </label>

          {/* GPS */}
          <UIButton onClick={captureGPS} disabled={capturingGeo || submitting} fullWidth>
            {capturingGeo ? 'กำลังจับพิกัด GPS…' : geo ? '📍 จับพิกัดใหม่' : '📍 กดเพื่อจับพิกัด GPS'}
          </UIButton>
          {capturingGeo && <LoadingState label="กำลังดึงพิกัดจากอุปกรณ์" />}
          {geo ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              ✅ {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)} · ±{Math.round(geo.accuracy)} เมตร
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⚠️ ยังไม่ได้จับพิกัด GPS</p>
          )}
        </section>
      )}

      {/* ── Step: photos ── */}
      {step === 'photos' && (
        <section className="kaona-card">
          <h3>2) แนบรูปแปลง</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
            แนบได้สูงสุด 4 รูป · แนะนำรูปมุมกว้างและจุดสังเกต
          </p>
          <input
            type="file" accept="image/*" capture="environment" multiple
            onChange={onSelectPhotos}
            disabled={submitting || photoFiles.length >= 4}
          />
          {photoFiles.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ยังไม่มีรูปที่แนบ</p>
          )}
          {photoFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📷 {file.name}
              </span>
              <UIButton type="button" onClick={() => removePhoto(index)} disabled={submitting}>
                ลบ
              </UIButton>
            </div>
          ))}
        </section>
      )}

      {/* ── Step: review ── */}
      {step === 'review' && (
        <section className="kaona-card">
          <h3>3) ตรวจทานก่อนส่ง</h3>
          <p>ชื่อแปลง: <strong>{plotName}</strong></p>
          <p>พื้นที่: <strong>{areaRai} ไร่</strong></p>
          <p>รายละเอียด: {plotNote || 'ไม่ระบุ'}</p>
          <p>พิกัด: {geo ? `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}` : '-'}</p>
          <p>ความแม่นยำ: {geo ? `±${Math.round(geo.accuracy)} เมตร` : '-'}</p>
          <p>รูปแนบ: {photoFiles.length} รูป</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            สถานะหลังส่ง: <strong>รอตรวจสอบ</strong>
          </p>
        </section>
      )}

      {/* ── Error / success ── */}
      {error && <ErrorState title="ไม่สามารถดำเนินการได้" detail={error} />}
      {successPlotId && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 10, padding: '12px 16px', marginTop: 8,
        }}>
          ✅ บันทึกแปลงสำเร็จ — สถานะ: รอตรวจสอบ
        </div>
      )}

      {/* ── Navigation buttons ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {step !== 'details' && (
          <UIButton
            type="button"
            onClick={() => setStep(step === 'photos' ? 'details' : 'photos')}
            disabled={submitting}
          >
            ย้อนกลับ
          </UIButton>
        )}
        {step === 'details' && (
          <UIButton
            type="button" fullWidth
            onClick={() => { setError(null); setStep('photos'); }}
            disabled={!detailsValid || !geo || submitting}
          >
            ถัดไป: แนบรูป →
          </UIButton>
        )}
        {step === 'photos' && (
          <UIButton
            type="button" fullWidth
            onClick={() => { setError(null); setStep('review'); }}
            disabled={photoFiles.length === 0 || submitting}
          >
            ถัดไป: ตรวจทาน →
          </UIButton>
        )}
        {step === 'review' && (
          <UIButton
            type="button" fullWidth
            onClick={submitPlot}
            disabled={!canSubmit || submitting}
            loading={submitting}
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึกแปลง'}
          </UIButton>
        )}
      </div>

      {/* ── My plots list ── */}
      <SectionHeader title="แปลงของฉัน" subtitle="แปลงที่ลงทะเบียนไว้แล้ว" />

      {loadingList && <LoadingState label="กำลังโหลดรายการแปลง…" />}
      {!loadingList && listError && <ErrorState title="โหลดไม่สำเร็จ" detail={listError} />}
      {!loadingList && !listError && plots.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>ยังไม่มีแปลงที่ลงทะเบียน</p>
      )}
      {!loadingList && !listError && plots.map((plot) => (
        <section key={plot.id} className="kaona-card">
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{plot.name}</p>
          <p style={{ margin: '0 0 4px', fontSize: 13 }}>
            {plot.area_rai} ไร่
            {plot.province ? ` · ${plot.province}` : ''}
          </p>
          {plot.lat && plot.lng && (
            <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
              📍 {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            สถานะ: {STATUS_TH[plot.status] ?? plot.status}
          </p>
          {plot.status === 'pending_review' && !editingPlotId && (
            <div style={{ marginTop: 8 }}>
              <UIButton type="button" onClick={() => reopenDraft(plot)}>
                ✏️ แก้ไขแปลงนี้
              </UIButton>
            </div>
          )}
        </section>
      ))}
    </MobileAppShell>
  );
}
