'use client';

import { type ChangeEvent, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type Props = {
  inspectionId   : string;
  plotName?      : string;
  farmerName?    : string;
  noBurnTiming?  : 'before_planting' | 'after_planting' | null;
  noBurnRequestId?: string | null;
  memberId?      : string;    // for photo upload path
  plotId?        : string;    // for photos.plot_id
  onSuccess?     : () => void;
};

const VERDICT_OPTS = [
  { value: 'passed',       label: '✅ ผ่าน',                color: '#059669', bg: '#f0fdf4' },
  { value: 'failed',       label: '❌ ไม่ผ่าน',             color: '#dc2626', bg: '#fef2f2' },
  { value: 'needs_update', label: '⚠️ ต้องแก้ไขเพิ่มเติม', color: '#d97706', bg: '#fffbeb' },
];

const TIMING_LABEL: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',      color: '#1565c0', bg: '#e3f2fd' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว',  color: '#2e7d32', bg: '#e8f5e9' },
};

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: refreshed } = await sb.auth.refreshSession();
  if (refreshed.session?.access_token) return refreshed.session.access_token;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

export function InspectorResultForm({
  inspectionId, plotName, farmerName, noBurnTiming, noBurnRequestId, memberId, plotId, onSuccess,
}: Props) {
  const [verdict,     setVerdict]     = useState('');
  const [note,        setNote]        = useState('');
  const [gps,         setGps]         = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsLoad,     setGpsLoad]     = useState(false);
  const [photoFiles,  setPhotoFiles]  = useState<File[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [uploadPct,   setUploadPct]   = useState<number | null>(null);

  // ── GPS ─────────────────────────────────────────────────────────────────────
  function getGps() {
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGpsLoad(false);
      },
      () => { setNotice('❌ ไม่สามารถดึง GPS ได้ กรุณาเปิดสิทธิ์ตำแหน่ง'); setGpsLoad(false); },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  // ── Photo ────────────────────────────────────────────────────────────────────
  function onPickPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  }
  function removePhoto(i: number) {
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    if (!verdict)      { setNotice('❌ กรุณาเลือกผลการตรวจ'); return; }
    if (!note.trim())  { setNotice('❌ กรุณากรอกบันทึกผลการตรวจ'); return; }
    setSaving(true);
    setNotice(null);

    // 1) Patch inspection result
    const token = await getBearerToken();
    const patchRes = await fetch('/api/field/inspections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        inspection_id:          inspectionId,
        result_status:          verdict,
        result_note:            note,
        gps_lat:                gps?.lat,
        gps_lng:                gps?.lng,
        gps_accuracy:           gps?.acc,
        inspector_submitted_at: new Date().toISOString(),
      }),
    });

    if (!patchRes.ok) {
      const d = (await patchRes.json()) as { error?: string };
      setSaving(false);
      setNotice(`❌ ${d.error ?? 'บันทึกไม่สำเร็จ'}`);
      return;
    }

    // 2) Upload photos (best-effort via Supabase storage)
    const photoWarnings: string[] = [];
    if (photoFiles.length > 0 && memberId) {
      const sb = tryCreateSupabaseBrowserClient();
      const capturedAt = new Date().toISOString();
      for (let i = 0; i < photoFiles.length; i++) {
        setUploadPct(Math.round(((i) / photoFiles.length) * 100));
        const file = photoFiles[i];
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${memberId}/inspection/${inspectionId}_photo${i}_${Date.now()}.${ext}`;

        const { error: uploadErr } = await sb!.storage
          .from('member-photos')
          .upload(path, file, { upsert: true });

        if (uploadErr) { photoWarnings.push(`photo${i}`); continue; }

        await sb!.from('photos').insert({
          member_id:           memberId,
          inspection_id:       inspectionId,
          no_burn_request_id:  noBurnRequestId ?? null,
          plot_id:             plotId ?? null,
          storage_path:        path,
          photo_type:          'inspection',
          evidence_status:     'submitted',
          lat:                 gps?.lat ?? null,
          lng:                 gps?.lng ?? null,
          accuracy:            gps?.acc ?? null,
          captured_at:         capturedAt,
          uploaded_by:         memberId,
        });
      }
    }
    setUploadPct(null);
    setSaving(false);

    const warn = photoWarnings.length ? ` (อัปโหลดรูปไม่สำเร็จ ${photoWarnings.length} รูป)` : '';
    setNotice(`✅ บันทึกผลการตรวจแล้ว${warn}`);
    onSuccess?.();
  }

  const selectedVerdict = VERDICT_OPTS.find((v) => v.value === verdict);
  const timingCfg = noBurnTiming ? TIMING_LABEL[noBurnTiming] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Notice */}
      {notice && (
        <div style={{
          background: notice.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notice.startsWith('✅') ? '#86efac' : '#fca5a5'}`,
          borderRadius: 10, padding: '10px 14px', fontWeight: 600,
          color: notice.startsWith('✅') ? '#14532d' : '#991b1b',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Context */}
      {(plotName || farmerName || timingCfg) && (
        <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          {plotName   && <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600 }}>🌱 {plotName}</p>}
          {farmerName && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>👤 {farmerName}</p>}
          {timingCfg  && (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 999,
              background: timingCfg.bg, color: timingCfg.color,
            }}>
              {timingCfg.icon} งดเผา{timingCfg.label}
            </span>
          )}
        </div>
      )}

      {/* Verdict */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
          ผลการตรวจ <span style={{ color: '#dc2626' }}>*</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {VERDICT_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setVerdict(opt.value)}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                fontWeight: 600, fontSize: 14,
                border:     `2px solid ${verdict === opt.value ? opt.color : '#e5e7eb'}`,
                background: verdict === opt.value ? opt.bg : '#fff',
                color:      verdict === opt.value ? opt.color : '#374151',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <label className="reg-label">
        บันทึกผลการตรวจ <span className="reg-required">*</span>
        <textarea className="reg-input" rows={4}
          placeholder="อธิบายสิ่งที่พบ สภาพแปลง และเหตุผลของผลการตรวจ…"
          value={note} onChange={(e) => setNote(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      </label>

      {/* GPS */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="admin-btn admin-btn--secondary" onClick={getGps} disabled={gpsLoad}
          style={{ fontSize: 13 }}>
          {gpsLoad ? '📡 กำลังดึง GPS…' : gps ? '📍 GPS แล้ว — อัปเดต' : '📍 บันทึก GPS'}
        </button>
        {gps && (
          <span style={{ fontSize: 11, color: '#059669' }}>
            {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            {gps.acc < 20 ? ' 🎯' : ` ±${Math.round(gps.acc)}m`}
          </span>
        )}
      </div>

      {/* Photos */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
          รูปหลักฐาน{' '}
          <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>(ไม่บังคับ · สูงสุด 5 รูป)</span>
        </p>
        <input type="file" accept="image/*" capture="environment" multiple
          onChange={onPickPhotos} disabled={saving || photoFiles.length >= 5} />
        {photoFiles.map((file, i) => (
          <div key={`${file.name}-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📷 {file.name}
            </span>
            <button onClick={() => removePhoto(i)} disabled={saving}
              style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer' }}>
              ลบ
            </button>
          </div>
        ))}
        {uploadPct !== null && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, borderRadius: 2, background: '#e0e0e0' }}>
              <div style={{ height: '100%', borderRadius: 2, background: '#059669', width: `${uploadPct}%`, transition: 'width .3s' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>กำลังอัปโหลดรูป {uploadPct}%…</p>
          </div>
        )}
      </div>

      {/* Submit */}
      <button className="admin-btn admin-btn--primary" onClick={submit}
        disabled={saving || !verdict}
        style={{ minHeight: 52, fontSize: 16, fontWeight: 700, background: selectedVerdict?.color }}>
        {saving ? 'กำลังบันทึก…' : `${selectedVerdict?.label ?? 'บันทึกผลการตรวจ'}`}
      </button>

    </div>
  );
}
