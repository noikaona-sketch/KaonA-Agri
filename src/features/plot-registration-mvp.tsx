'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { ErrorState }    from '@/shared/components/error-state';
import { LoadingState }  from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader }  from '@/shared/components/section-header';
import { UIButton }       from '@/shared/components/ui-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type GeoLocation = {
  latitude:   number;
  longitude:  number;
  accuracy:   number;
  capturedAt: string;
};

type Step = 'details' | 'photos' | 'review';

type PlotRow = {
  id:            string;
  name:          string;
  area_rai:      number;
  accuracy:      number | null;
  description:   string | null;
  status:        string;
  province:      string | null;
  land_doc_type: string | null;
  lat:           number | null;
  lng:           number | null;
  photo_count:   number;
  created_at:    string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_TH: Record<string, string> = {
  pending_review: 'รอตรวจสอบ',
  active:         'ใช้งาน',
  inactive:       'ไม่ใช้งาน',
};

const STATUS_COLOR: Record<string, string> = {
  pending_review: '#e65100',
  active:         '#2e7d32',
  inactive:       '#9e9e9e',
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function PlotRegistrationMVP() {
  const member        = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  // ── Form / flow state ───────────────────────────────────────────────────────
  const [step,          setStep]          = useState<Step>('details');
  const [plotName,      setPlotName]      = useState('');
  const [areaRai,       setAreaRai]       = useState('');
  const [plotNote,      setPlotNote]      = useState('');
  const [province,      setProvince]      = useState('');
  const [geo,           setGeo]           = useState<GeoLocation | null>(null);
  const [gpsExplicit,   setGpsExplicit]   = useState(false); // true only after captureGPS
  const [photoFiles,    setPhotoFiles]    = useState<File[]>([]);
  const [capturingGeo,  setCapturingGeo]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Edit mode — reopen a pending_review draft
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [savedAction,   setSavedAction]   = useState<'created' | 'updated' | null>(null);

  // ── My plots list ───────────────────────────────────────────────────────────
  const [plots,       setPlots]       = useState<PlotRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]   = useState<string | null>(null);

  // ── Validation ──────────────────────────────────────────────────────────────
  const areaValue    = Number(areaRai);
  const detailsValid = plotName.trim().length > 0 && Number.isFinite(areaValue) && areaValue > 0;

  // New plot requires photos; editing an existing plot does not (photos optional on edit)
  const canSubmit = useMemo(
    () => detailsValid && geo !== null && (editingPlotId !== null || photoFiles.length > 0),
    [detailsValid, geo, editingPlotId, photoFiles.length],
  );

  // ── Photo selection ─────────────────────────────────────────────────────────
  function onSelectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 4));
    event.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── GPS capture — only way to set/change GPS ────────────────────────────────
  // GPS fields are never editable via text input — only via this function.
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
        setGpsExplicit(true);
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

  // ── Reset form ──────────────────────────────────────────────────────────────
  function resetForm() {
    setStep('details');
    setPlotName('');
    setAreaRai('');
    setPlotNote('');
    setProvince('');
    setGeo(null);
    setGpsExplicit(false);
    setPhotoFiles([]);
    setError(null);
    setEditingPlotId(null);
  }

  // ── Open a pending_review plot for editing ──────────────────────────────────
  function reopenDraft(plot: PlotRow) {
    setEditingPlotId(plot.id);
    setPlotName(plot.name);
    setAreaRai(String(plot.area_rai));
    setPlotNote(plot.description ?? '');
    setProvince(plot.province ?? '');
    // Restore GPS from saved values — shown as read-only until explicitly recaptured
    setGeo(
      plot.lat !== null && plot.lng !== null
        ? { latitude: plot.lat, longitude: plot.lng, accuracy: plot.accuracy ?? 0, capturedAt: '' }
        : null,
    );
    setGpsExplicit(false); // GPS is from DB, not newly captured
    setPhotoFiles([]);
    setError(null);
    setSavedAction(null);
    setStep('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submitPlot() {
    setError(null);
    setSavedAction(null);

    if (!member?.is_approved || member.status !== 'approved') {
      setError('เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้นที่ลงทะเบียนแปลงได้');
      return;
    }
    if (!geo) {
      setError('กรุณากดจับพิกัด GPS ก่อนส่งข้อมูล');
      return;
    }
    if (!editingPlotId && photoFiles.length === 0) {
      setError('กรุณาแนบรูปแปลงอย่างน้อย 1 รูป');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getBearerToken();

      if (editingPlotId) {
        // ── PATCH: update existing pending_review draft ────────────────────────
        // GPS fields sent only if member explicitly recaptured (gpsExplicit = true)
        const patchBody: Record<string, unknown> = {
          plot_id:     editingPlotId,
          name:        plotName.trim(),
          area_rai:    areaValue,
          description: plotNote.trim() || null,
          province:    province.trim() || null,
        };
        if (gpsExplicit) {
          patchBody.lat      = geo.latitude;
          patchBody.lng      = geo.longitude;
          patchBody.accuracy = geo.accuracy;
        }

        const res = await fetch('/api/member/plot-registration', {
          method:  'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(patchBody),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || json.error) {
          setError(json.error ?? 'แก้ไขไม่สำเร็จ กรุณาลองใหม่');
          setSubmitting(false);
          return;
        }
        setSavedAction('updated');

      } else {
        // ── POST: create new plot ──────────────────────────────────────────────
        const form = new FormData();
        form.append('name',     plotName.trim());
        form.append('area_rai', String(areaValue));
        form.append('lat',      String(geo.latitude));
        form.append('lng',      String(geo.longitude));
        form.append('accuracy', String(geo.accuracy));
        if (plotNote.trim())  form.append('description', plotNote.trim());
        if (province.trim())  form.append('province',    province.trim());
        photoFiles.forEach((file, i) => form.append(`photo_${i}`, file));

        const res = await fetch('/api/member/plot-registration', {
          method:  'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    form,
          // No Content-Type — browser sets multipart boundary automatically
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
        setSavedAction('created');
      }

      resetForm();
      void loadPlots();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    setSubmitting(false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  const isEditing = editingPlotId !== null;

  return (
    <MobileAppShell
      title={isEditing ? 'แก้ไขแปลง (รอตรวจสอบ)' : 'ลงทะเบียนแปลงเกษตร'}
      subtitle="รายละเอียด → แนบรูป → ตรวจทาน → บันทึก"
      roleBadge={effectiveRole ?? 'farmer'}
    >
      <SectionHeader
        title={isEditing ? 'แก้ไขแปลงที่รอตรวจสอบ' : 'ขั้นตอนลงทะเบียน'}
        subtitle="รายละเอียดแปลง → แนบรูป → ตรวจทาน → บันทึก"
      />

      {/* Cancel edit */}
      {isEditing && (
        <div style={{ marginBottom: 12 }}>
          <UIButton type="button" onClick={resetForm} disabled={submitting}>
            ← ยกเลิกการแก้ไข
          </UIButton>
        </div>
      )}

      {/* ── Step: details ── */}
      {step === 'details' && (
        <section className="kaona-card">
          <h3 style={{ marginTop: 0 }}>1) รายละเอียดแปลง</h3>

          <label>
            ชื่อแปลง <span style={{ color: '#e53e3e' }}>*</span>
            <input
              value={plotName}
              onChange={(e) => setPlotName(e.target.value)}
              disabled={submitting}
              placeholder="เช่น แปลงนาบ้านหนองบัว"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              พื้นที่ (ไร่) <span style={{ color: '#e53e3e' }}>*</span>
              <input
                type="number" inputMode="decimal" min="0" step="0.25"
                value={areaRai}
                onChange={(e) => setAreaRai(e.target.value)}
                disabled={submitting}
                placeholder="0.00"
              />
            </label>
            <label>
              จังหวัด
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                disabled={submitting}
                placeholder="เช่น อุบลราชธานี"
              />
            </label>
          </div>

          <label>
            รายละเอียดเพิ่มเติม
            <textarea
              value={plotNote}
              onChange={(e) => setPlotNote(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="เช่น จุดสังเกต ลักษณะพื้นที่ ทางเข้า"
            />
          </label>

          {/* GPS — read-only display; changes only via captureGPS */}
          <UIButton onClick={captureGPS} disabled={capturingGeo || submitting} fullWidth>
            {capturingGeo
              ? 'กำลังจับพิกัด GPS…'
              : geo
              ? `📍 จับพิกัดใหม่ (ปัจจุบัน: ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)})`
              : '📍 กดเพื่อจับพิกัด GPS ณ ตำแหน่งแปลง'}
          </UIButton>
          {capturingGeo && <LoadingState label="กำลังดึงพิกัดจากอุปกรณ์" />}
          {geo && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
              {gpsExplicit ? '✅ จับพิกัดใหม่แล้ว' : 'ℹ️ พิกัดจากฐานข้อมูล (กดปุ่มด้านบนเพื่ออัปเดต)'}
              {' '}· {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
              {geo.accuracy > 0 ? ` · ±${Math.round(geo.accuracy)} ม.` : ''}
            </p>
          )}
          {!geo && (
            <p style={{ fontSize: 12, color: '#e53e3e', margin: '4px 0 0' }}>
              ⚠️ ต้องยืนอยู่ที่แปลงจริงเพื่อจับพิกัด
            </p>
          )}
        </section>
      )}

      {/* ── Step: photos ── */}
      {step === 'photos' && (
        <section className="kaona-card">
          <h3 style={{ marginTop: 0 }}>2) แนบรูปแปลง</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
            {isEditing
              ? 'แนบรูปเพิ่มเติม (ไม่บังคับสำหรับการแก้ไข) · สูงสุด 4 รูป'
              : 'แนบได้สูงสุด 4 รูป · ต้องมีอย่างน้อย 1 รูป'}
          </p>
          <input
            type="file" accept="image/*" capture="environment" multiple
            onChange={onSelectPhotos}
            disabled={submitting || photoFiles.length >= 4}
          />
          {photoFiles.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {isEditing ? 'ไม่มีรูปใหม่ (รูปเดิมยังคงอยู่)' : 'ยังไม่มีรูปที่แนบ'}
            </p>
          )}
          {photoFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}
            >
              <span style={{
                flex: 1, fontSize: 13, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
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
          <h3 style={{ marginTop: 0 }}>3) ตรวจทานก่อนบันทึก</h3>
          <p>ชื่อแปลง: <strong>{plotName}</strong></p>
          <p>พื้นที่: <strong>{areaRai} ไร่</strong></p>
          {province && <p>จังหวัด: {province}</p>}
          <p>รายละเอียด: {plotNote || 'ไม่ระบุ'}</p>
          <p>
            พิกัด:{' '}
            {geo
              ? `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}` +
                (geo.accuracy > 0 ? ` ±${Math.round(geo.accuracy)} ม.` : '')
              : '-'}
            {geo && !gpsExplicit && isEditing && (
              <span style={{ fontSize: 11, color: '#e65100' }}> (ค่าเดิม — ไม่ได้จับใหม่)</span>
            )}
          </p>
          {!isEditing && <p>รูปแนบ: {photoFiles.length} รูป</p>}
          {isEditing && photoFiles.length > 0 && <p>รูปใหม่แนบ: {photoFiles.length} รูป</p>}
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            สถานะ: <strong>รอตรวจสอบ</strong>{isEditing ? ' (ไม่เปลี่ยน)' : ''}
          </p>
        </section>
      )}

      {/* Error */}
      {error && <ErrorState title="ไม่สามารถดำเนินการได้" detail={error} />}

      {/* Success */}
      {savedAction && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 10, padding: '12px 16px', marginTop: 8,
        }}>
          {savedAction === 'created'
            ? '✅ บันทึกแปลงใหม่สำเร็จ — สถานะ: รอตรวจสอบ'
            : '✅ แก้ไขแปลงสำเร็จ — สถานะยังคงเป็น: รอตรวจสอบ'}
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {step !== 'details' && (
          <UIButton
            type="button"
            onClick={() => setStep(step === 'photos' ? 'details' : 'photos')}
            disabled={submitting}
          >
            ← ย้อนกลับ
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
            disabled={(!isEditing && photoFiles.length === 0) || submitting}
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
            {submitting
              ? 'กำลังบันทึก…'
              : isEditing
              ? 'บันทึกการแก้ไข'
              : 'บันทึกแปลง'}
          </UIButton>
        )}
      </div>

      {/* ── My plots list ── */}
      <SectionHeader title="แปลงของฉัน" subtitle="แปลงที่ลงทะเบียนไว้แล้ว" />

      {loadingList && <LoadingState label="กำลังโหลดรายการแปลง…" />}
      {!loadingList && listError && <ErrorState title="โหลดไม่สำเร็จ" detail={listError} />}
      {!loadingList && !listError && plots.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ยังไม่มีแปลงที่ลงทะเบียน
        </p>
      )}

      {!loadingList && !listError && plots.map((plot) => {
        const color = STATUS_COLOR[plot.status] ?? '#1565c0';
        const isCurrentEdit = editingPlotId === plot.id;
        return (
          <section
            key={plot.id}
            className="kaona-card"
            style={{ opacity: isCurrentEdit ? 0.7 : 1 }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{plot.name}</p>
              <span style={{
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                padding: '3px 8px', borderRadius: 999,
                background: `${color}22`, color,
              }}>
                {STATUS_TH[plot.status] ?? plot.status}
              </span>
            </div>

            {/* Area + province */}
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {plot.area_rai} ไร่{plot.province ? ` · ${plot.province}` : ''}
            </p>

            {/* GPS summary */}
            {plot.lat !== null && plot.lng !== null && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                📍 {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}
                {plot.accuracy ? ` ±${Math.round(plot.accuracy)} ม.` : ''}
              </p>
            )}

            {/* Description excerpt */}
            {plot.description && (
              <p style={{
                margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                📝 {plot.description}
              </p>
            )}

            {/* Photo count */}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              📷 {plot.photo_count > 0 ? `${plot.photo_count} รูป` : 'ยังไม่มีรูป'}
            </p>

            {/* Edit button — only pending_review, only when not already editing */}
            {plot.status === 'pending_review' && !editingPlotId && (
              <div style={{ marginTop: 10 }}>
                <UIButton type="button" onClick={() => reopenDraft(plot)}>
                  ✏️ แก้ไขแปลงนี้
                </UIButton>
              </div>
            )}
            {isCurrentEdit && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#e65100', fontWeight: 600 }}>
                กำลังแก้ไขอยู่ ↑
              </p>
            )}
          </section>
        );
      })}
    </MobileAppShell>
  );
}
