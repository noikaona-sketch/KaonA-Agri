'use client';

import { useRef, useState } from 'react';
import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell }            from '@/shared/components/mobile-app-shell';
import { LoadingState }              from '@/shared/components/loading-state';
import { ProtectedRoute }            from '@/shared/components/protected-route';
import { compressFieldPhoto }            from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const CROP_TYPES = [
  { value: 'corn',      label: '🌽 ข้าวโพด' },
  { value: 'rice',      label: '🌾 ข้าว' },
  { value: 'cassava',   label: '🍠 มันสำปะหลัง' },
  { value: 'sugarcane', label: '🎋 อ้อย' },
  { value: 'other',     label: '🌿 อื่นๆ' },
];

const GROWTH_STAGES: Record<string, { label: string; days: string }> = {
  germination: { label: 'งอก',        days: '0–7 วัน' },
  seedling:    { label: 'ต้นกล้า',    days: '7–21 วัน' },
  vegetative:  { label: 'เจริญเติบโต', days: '21–45 วัน' },
  tasseling:   { label: 'ออกไหม',     days: '45–60 วัน' },
  silking:     { label: 'ออกไหม/ฝัก', days: '55–65 วัน' },
  grain_fill:  { label: 'เมล็ดพัฒนา', days: '65–90 วัน' },
  maturity:    { label: 'แก่/สุก',    days: '90–110 วัน' },
  harvest_ready: { label: 'พร้อมเก็บ', days: '110+ วัน' },
};

const CONDITIONS = [
  { value: 'healthy',     label: '✅ ปกติ/แข็งแรง',  color: '#2e7d32' },
  { value: 'stressed',    label: '⚠️ อาการเครียด',   color: '#e65100' },
  { value: 'pest_damage', label: '🐛 ศัตรูพืช',       color: '#c62828' },
  { value: 'disease',     label: '🦠 โรคพืช',         color: '#6a1b9a' },
  { value: 'drought',     label: '🌵 แล้ง/ขาดน้ำ',   color: '#bf360c' },
  { value: 'flood',       label: '🌊 น้ำท่วม',        color: '#0277bd' },
  { value: 'other',       label: '📝 อื่นๆ',           color: '#546e7a' },
];

const INP  = { padding: '10px 13px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff' };
const LBL  = { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties;
const SEC  = { fontWeight: 800, fontSize: 14, color: '#1a1a1a', margin: '12px 0 4px' } as React.CSSProperties;

// ── Read EXIF GPS from JPEG ───────────────────────────────────────────────────
function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf  = e.target?.result as ArrayBuffer;
        const view = new DataView(buf);
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
        let offset = 2;
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset);
          const len    = view.getUint16(offset + 2);
          if (marker === 0xFFE1) {
            const hdr = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
            if (hdr === 'Exif') {
              const t = offset + 10;
              const isLE = view.getUint16(t) === 0x4949;
              const r16 = (o: number) => isLE ? view.getUint16(t+o,true) : view.getUint16(t+o);
              const r32 = (o: number) => isLE ? view.getUint32(t+o,true) : view.getUint32(t+o);
              const ifd0 = r32(4); const n = r16(ifd0);
              let gpsOff = 0;
              for (let i = 0; i < n; i++) { if (r16(ifd0+2+i*12) === 0x8825) { gpsOff = r32(ifd0+2+i*12+8); break; } }
              if (!gpsOff) { resolve(null); return; }
              const gn = r16(gpsOff); let latRef='', lngRef='', latRat: number[]=[], lngRat: number[]=[];
              for (let i = 0; i < gn; i++) {
                const b = gpsOff+2+i*12; const tag = r16(b); const cnt = r32(b+4); const vo = b+8;
                if (tag===0x0001) latRef = String.fromCharCode(view.getUint8(t+r32(vo)));
                else if (tag===0x0003) lngRef = String.fromCharCode(view.getUint8(t+r32(vo)));
                else if ((tag===0x0002||tag===0x0004) && r16(b+2)===5) {
                  const d = r32(vo); const rats: number[] = [];
                  for (let j=0;j<cnt;j++) { const num=r32(d+j*8); const den=r32(d+j*8+4); rats.push(den?num/den:0); }
                  if (tag===0x0002) latRat=rats; else lngRat=rats;
                }
              }
              if (latRat.length>=3 && lngRat.length>=3) {
                let lat = latRat[0]+latRat[1]/60+latRat[2]/3600;
                let lng = lngRat[0]+lngRat[1]/60+lngRat[2]/3600;
                if (latRef==='S') lat=-lat; if (lngRef==='W') lng=-lng;
                if (lat||lng) { resolve({ lat, lng }); return; }
              }
            }
          }
          offset += 2 + len;
        }
        resolve(null);
      } catch { resolve(null); }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

// ── Photo preview tile ────────────────────────────────────────────────────────
function PhotoTile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = URL.createObjectURL(file);
  return (
    <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <button onClick={onRemove} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
function SurveyForm() {
  const { status } = useAuth();
  const member  = useCurrentMember();
  const fileRef = useRef<HTMLInputElement>(null);

  // Location
  const [lat,      setLat]      = useState<number | null>(null);
  const [lng,      setLng]      = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Crop info
  const [cropType,    setCropType]    = useState('corn');
  const [cropNote,    setCropNote]    = useState('');
  const [ageDays,     setAgeDays]     = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [stage,       setStage]       = useState('');
  const [condition,   setCondition]   = useState('');
  const [condNote,    setCondNote]    = useState('');
  const [note,        setNote]        = useState('');

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoGps, setPhotoGps] = useState<{ lat: number; lng: number } | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;

  // ── GPS capture ─────────────────────────────────────────────────────────────
  async function captureGps() {
    setGpsLoading(true); setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
      );
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setAccuracy(pos.coords.accuracy);
      setGpsLabel(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} ±${Math.round(pos.coords.accuracy)}ม.`);
    } catch (e) { setError(`GPS: ${e instanceof Error ? e.message : String(e)}`); }
    setGpsLoading(false);
  }

  // ── Photo picker ─────────────────────────────────────────────────────────────
  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    if (!files.length) return;

    // Try EXIF from first photo if no GPS yet
    if (!lat && files[0]) {
      const exif = await readExifGps(files[0]);
      if (exif) {
        setLat(exif.lat); setLng(exif.lng);
        setGpsLabel(`จาก EXIF: ${exif.lat.toFixed(5)}, ${exif.lng.toFixed(5)}`);
        setPhotoGps(exif);
      }
    }
    setPhotos(prev => [...prev, ...files].slice(0, 4));
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!member?.member_id) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!lat || !lng)       { setError('กรุณาจับพิกัด GPS ก่อนบันทึก'); return; }
    setSubmitting(true); setError(null);

    // Get Bearer token
    const sb = tryCreateSupabaseBrowserClient();
    const sess = sb ? await sb.auth.getSession() : null;
    const token = sess?.data?.session?.access_token ?? null;
    if (!token) { setError('Session หมดอายุ กรุณา reload'); setSubmitting(false); return; }

    const form = new FormData();
    form.append('lat',       String(lat));
    form.append('lng',       String(lng));
    if (accuracy)   form.append('accuracy',             String(accuracy));
    form.append('crop_type', cropType);
    if (cropNote)   form.append('crop_type_note',       cropNote);
    if (ageDays)    form.append('estimated_age_days',   ageDays);
    if (areaRai)    form.append('estimated_area_rai',   areaRai);
    if (stage)      form.append('growth_stage',         stage);
    if (condition)  form.append('plant_condition',      condition);
    if (condNote)   form.append('condition_note',       condNote);
    if (note)       form.append('note',                 note);

    // Compress all photos before upload
    const compressedPhotos = await Promise.all(photos.map(p => compressFieldPhoto(p)));
    compressedPhotos.forEach(({ processedFile: photo }, i) => {
      form.append(`photo_${i}`, photo);
      if (photoGps) {
        form.append(`photo_lat_${i}`, String(photoGps.lat));
        form.append(`photo_lng_${i}`, String(photoGps.lng));
      }
    });

    const res = await fetch('/api/field/survey-observation', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });

    const data = (await res.json()) as { ok?: boolean; observation_id?: string; error?: string; photo_warnings?: string[] };
    setSubmitting(false);

    if (!res.ok) { setError(data.error ?? 'บันทึกไม่สำเร็จ'); return; }

    // Reset form
    setLat(null); setLng(null); setAccuracy(null); setGpsLabel(null);
    setCropType('corn'); setCropNote(''); setAgeDays(''); setAreaRai('');
    setStage(''); setCondition(''); setCondNote(''); setNote('');
    setPhotos([]); setPhotoGps(null);

    const warn = data.photo_warnings?.length ? ` (${data.photo_warnings.length} รูปอัพโหลดไม่สำเร็จ)` : '';
    setSuccess(`✅ บันทึกแล้ว${warn}`);
    setTimeout(() => setSuccess(null), 4000);
  }

  const canSubmit = !!lat && !!lng && !submitting && !!member?.member_id;

  return (
    <div className="mobile-stack" style={{ paddingBottom: 32 }}>
      {success && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', color: '#1b5e20', fontWeight: 700, fontSize: 13 }}>{success}</div>}
      {error   && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{error}</div>}

      {/* ── GPS ── */}
      <p style={SEC}>📍 พิกัด GPS <span style={{ color: '#c62828' }}>*</span></p>
      <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: '14px 16px' }}>
        {gpsLabel && <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '7px 12px' }}>✅ {gpsLabel}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={captureGps} disabled={gpsLoading}
            style={{ padding: '11px 8px', borderRadius: 10, border: '1.5px solid #86efac', background: gpsLoading ? '#e5e7eb' : '#fff', fontSize: 13, fontWeight: 700, cursor: gpsLoading ? 'not-allowed' : 'pointer', color: '#166534' }}>
            {gpsLoading ? '⏳ จับ GPS…' : '📡 จับพิกัด GPS'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={photos.length >= 4}
            style={{ padding: '11px 8px', borderRadius: 10, border: '1.5px solid #86efac', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#166534' }}>
            📷 ถ่าย/เลือกรูป
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#4ade80', textAlign: 'center' }}>
          ถ่ายรูปในแปลง → ระบบอ่าน EXIF GPS อัตโนมัติ
        </p>
      </div>

      {/* ── Photos ── */}
      {photos.length > 0 && (
        <>
          <p style={SEC}>🖼️ รูปภาพ ({photos.length}/4)</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((f, i) => (
              <PhotoTile key={i} file={f} onRemove={() => setPhotos(prev => prev.filter((_, j) => j !== i))} />
            ))}
            {photos.length < 4 && (
              <button onClick={() => fileRef.current?.click()}
                style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed #d1d5db', background: '#f9fafb', color: '#9ca3af', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +
              </button>
            )}
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
        style={{ display: 'none' }} onChange={handlePhotos} />

      {/* ── Crop type ── */}
      <p style={SEC}>🌽 ชนิดพืช</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CROP_TYPES.map(c => (
          <button key={c.value} onClick={() => setCropType(c.value)}
            style={{ padding: '8px 14px', borderRadius: 99, border: `2px solid ${cropType === c.value ? '#2e7d32' : '#e5e7eb'}`, background: cropType === c.value ? '#e8f5e9' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: cropType === c.value ? '#1b5e20' : '#374151' }}>
            {c.label}
          </button>
        ))}
      </div>
      {cropType === 'other' && (
        <input style={INP} placeholder="ระบุชนิดพืช" value={cropNote} onChange={e => setCropNote(e.target.value)} />
      )}

      {/* ── Growth stage ── */}
      <p style={SEC}>🌱 ระยะการเจริญเติบโต</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {Object.entries(GROWTH_STAGES).map(([k, v]) => (
          <button key={k} onClick={() => setStage(stage === k ? '' : k)}
            style={{ padding: '9px 12px', borderRadius: 10, border: `2px solid ${stage===k ? '#1565c0' : '#e5e7eb'}`, background: stage===k ? '#e3f2fd' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: stage===k ? '#0d47a1' : '#374151', textAlign: 'left' }}>
            <div>{v.label}</div>
            <div style={{ fontSize: 10, fontWeight: 400, color: stage===k ? '#1565c0' : '#9ca3af', marginTop: 1 }}>{v.days}</div>
          </button>
        ))}
      </div>

      {/* ── Age + Area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={LBL}>อายุโดยประมาณ (วัน)
          <input style={INP} type="number" min="0" value={ageDays} onChange={e => setAgeDays(e.target.value)} placeholder="เช่น 45" />
        </label>
        <label style={LBL}>พื้นที่โดยประมาณ (ไร่)
          <input style={INP} type="number" step="0.5" min="0" value={areaRai} onChange={e => setAreaRai(e.target.value)} placeholder="เช่น 5" />
        </label>
      </div>

      {/* ── Plant condition ── */}
      <p style={SEC}>🩺 สภาพพืช</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CONDITIONS.map(c => (
          <button key={c.value} onClick={() => setCondition(condition === c.value ? '' : c.value)}
            style={{ padding: '7px 12px', borderRadius: 99, border: `2px solid ${condition===c.value ? c.color : '#e5e7eb'}`, background: condition===c.value ? c.color+'18' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: condition===c.value ? c.color : '#374151' }}>
            {c.label}
          </button>
        ))}
      </div>
      {condition && condition !== 'healthy' && (
        <input style={INP} placeholder="รายละเอียดสภาพพืช" value={condNote} onChange={e => setCondNote(e.target.value)} />
      )}

      {/* ── Note ── */}
      <label style={LBL}>📝 บันทึกเพิ่มเติม
        <textarea style={{ ...INP, resize: 'vertical' }} rows={3}
          placeholder="สังเกตุพิเศษ สิ่งที่น่าสนใจ ฯลฯ"
          value={note} onChange={e => setNote(e.target.value)} />
      </label>

      {/* ── Submit ── */}
      <button onClick={handleSubmit} disabled={!canSubmit}
        style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: canSubmit ? '#2e7d32' : '#e5e7eb', color: canSubmit ? '#fff' : '#9ca3af', fontSize: 15, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
        {submitting ? '⏳ กำลังบันทึก…' : '📋 บันทึกการสำรวจ'}
      </button>

      {!lat && <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0 }}>จับพิกัด GPS ก่อนถึงจะบันทึกได้</p>}
    </div>
  );
}

export default function FieldSurveyPage() {
  return (
    <ProtectedRoute allowedRoles={['inspector', 'admin']}>
      <MobileAppShell title="📋 สำรวจภาคสนาม" subtitle="บันทึกการสำรวจพืชในพื้นที่">
        <SurveyForm />
      </MobileAppShell>
    </ProtectedRoute>
  );
}


