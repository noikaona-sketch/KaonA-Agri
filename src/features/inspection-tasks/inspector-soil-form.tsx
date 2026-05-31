'use client';

import { type ChangeEvent, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton } from '@/shared/components/ui-button';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  inspectionId   : string;
  plotName?      : string;
  farmerName?    : string;
  memberId?      : string;
  plotId?        : string;
  noBurnRequestId?: string | null;
  onSuccess?     : () => void;
};

type Geo = { lat: number; lng: number; acc: number };

// ─── Option maps ──────────────────────────────────────────────────────────────

const VERDICT_OPTS = [
  { value: 'passed',       label: '✅ ผ่าน',                 color: '#059669', bg: '#f0fdf4' },
  { value: 'failed',       label: '❌ ไม่ผ่าน',              color: '#dc2626', bg: '#fef2f2' },
  { value: 'needs_update', label: '⚠️ ต้องแก้ไขเพิ่มเติม',  color: '#d97706', bg: '#fffbeb' },
];

const SOIL_COLORS = [
  { v: 'dark_brown', l: '🟫 น้ำตาลเข้ม' },
  { v: 'brown',      l: '🟤 น้ำตาล' },
  { v: 'red',        l: '🔴 แดง' },
  { v: 'grey',       l: '⚫ เทา' },
  { v: 'black',      l: '⬛ ดำ' },
  { v: 'other',      l: '— อื่นๆ' },
];
const SOIL_TEXTURES = [
  { v: 'sandy', l: '🏖️ ทราย — ร่วนมาก' },
  { v: 'loamy', l: '✅ ร่วน — เหมาะปลูก' },
  { v: 'clay',  l: '🧱 เหนียว' },
  { v: 'silty', l: '💧 ตะกอน' },
  { v: 'rocky', l: '🪨 กรวด/หิน' },
];
const SOIL_DRAINAGES = [
  { v: 'good',        l: '✅ ระบาย ดี' },
  { v: 'moderate',    l: '🟡 ระบาย ปานกลาง' },
  { v: 'poor',        l: '🟠 ระบาย แย่' },
  { v: 'waterlogged', l: '🔴 น้ำขัง' },
];
const SOIL_MOISTURES = [
  { v: 'dry',       l: '☀️ แห้ง' },
  { v: 'moist',     l: '✅ ชื้น เหมาะสม' },
  { v: 'wet',       l: '💧 เปียก' },
  { v: 'saturated', l: '🌊 อิ่มตัว' },
];
const SOIL_ISSUE_OPTS = [
  { v: 'erosion',     l: '🌀 การกัดเซาะ' },
  { v: 'compaction',  l: '🧱 ดินอัดแน่น' },
  { v: 'saline',      l: '🧂 ดินเค็ม' },
  { v: 'acidic',      l: '🧪 ดินเป็นกรด' },
  { v: 'weed',        l: '🌿 วัชพืชมาก' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function uploadPhoto(
  sb: ReturnType<typeof tryCreateSupabaseBrowserClient>,
  memberId: string,
  inspectionId: string,
  file: File,
  photoType: 'inspection' | 'soil_cert' | 'soil_lab',
  idx: number,
  geo: Geo | null,
  noBurnRequestId?: string | null,
  plotId?: string,
): Promise<string | null> {
  if (!sb) return null;
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${memberId}/inspection/${inspectionId}_${photoType}${idx}_${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('member-photos').upload(path, file, { upsert: true });
  if (error) return null;

  await sb.from('photos').insert({
    member_id:          memberId,
    inspection_id:      inspectionId,
    no_burn_request_id: noBurnRequestId ?? null,
    plot_id:            plotId ?? null,
    storage_path:       path,
    photo_type:         photoType,
    evidence_status:    'submitted',
    lat:                geo?.lat ?? null,
    lng:                geo?.lng ?? null,
    accuracy:           geo?.acc ?? null,
    captured_at:        new Date().toISOString(),
    uploaded_by:        memberId,
  });
  return path;
}

// ─── Section wrappers ─────────────────────────────────────────────────────────

const S = {
  section: {
    background: '#fff',
    border: '1px solid var(--border,#d8e0db)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'grid',
    gap: 12,
  } as React.CSSProperties,
  sectionTitle: {
    margin: 0, fontWeight: 700, fontSize: 14,
    color: 'var(--text-primary,#1a1f1c)',
    display: 'flex', alignItems: 'center', gap: 6,
  } as React.CSSProperties,
  chipRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 7,
  },
  chip: (active: boolean, color = '#2e7d32'): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
    border: `1.5px solid ${active ? color : '#d8e0db'}`,
    background: active ? color + '18' : '#fff',
    color: active ? color : 'var(--text-secondary,#4e5a53)',
    fontWeight: active ? 700 : 400,
  }),
  label: {
    display: 'grid', gap: 4,
    fontSize: 13, fontWeight: 600,
    color: 'var(--text-primary,#1a1f1c)',
  } as React.CSSProperties,
  input: {
    padding: '9px 12px', borderRadius: 10,
    border: '1.5px solid var(--border,#d8e0db)',
    fontSize: 14, background: '#fff',
    color: 'var(--text-primary,#1a1f1c)',
    width: '100%',
  } as React.CSSProperties,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function InspectorSoilForm({
  inspectionId, plotName, farmerName, memberId, plotId, noBurnRequestId, onSuccess,
}: Props) {

  // Core
  const [verdict,    setVerdict]    = useState('');
  const [note,       setNote]       = useState('');
  const [geo,        setGeo]        = useState<Geo | null>(null);
  const [gpsLoad,    setGpsLoad]    = useState(false);

  // A: Soil
  const [soilColor,    setSoilColor]    = useState('');
  const [soilTexture,  setSoilTexture]  = useState('');
  const [soilDrainage, setSoilDrainage] = useState('');
  const [soilMoisture, setSoilMoisture] = useState('');
  const [soilIssues,   setSoilIssues]   = useState<string[]>([]);
  const [soilNote,     setSoilNote]     = useState('');

  // C: Cert
  const [hasCert,        setHasCert]        = useState(false);
  const [certAgency,     setCertAgency]     = useState('');
  const [certNumber,     setCertNumber]     = useState('');
  const [certIssuedDate, setCertIssuedDate] = useState('');
  const [certExpiresDate,setCertExpiresDate]= useState('');
  const [certPhotos,     setCertPhotos]     = useState<File[]>([]);

  // Lab
  const [hasLab,         setHasLab]         = useState(false);
  const [labName,        setLabName]        = useState('');
  const [labSubmittedAt, setLabSubmittedAt] = useState('');
  const [labTrackingNo,  setLabTrackingNo]  = useState('');
  const [labPhotos,      setLabPhotos]      = useState<File[]>([]);

  // UI state
  const [saving,     setSaving]     = useState(false);
  const [uploadPct,  setUploadPct]  = useState<number | null>(null);
  const [notice,     setNotice]     = useState<{ ok: boolean; msg: string } | null>(null);

  // ── GPS ──────────────────────────────────────────────────────────────────────
  function getGps() {
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsLoad(false); },
      () => { setNotice({ ok: false, msg: 'ไม่สามารถดึง GPS ได้' }); setGpsLoad(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ── Toggle issue ─────────────────────────────────────────────────────────────
  function toggleIssue(v: string) {
    setSoilIssues((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  }

  // ── Photo pickers ─────────────────────────────────────────────────────────────
  function pickCertPhotos(e: ChangeEvent<HTMLInputElement>) {
    setCertPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 3));
    e.target.value = '';
  }
  function pickLabPhotos(e: ChangeEvent<HTMLInputElement>) {
    setLabPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 3));
    e.target.value = '';
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    if (!verdict) { setNotice({ ok: false, msg: 'กรุณาเลือกผลการตรวจ' }); return; }
    if (!note.trim()) { setNotice({ ok: false, msg: 'กรุณากรอกบันทึกผลการตรวจ' }); return; }
    setSaving(true); setNotice(null);

    const token = await getBearerToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    const res = await fetch('/api/field/inspections', {
      method: 'PATCH', headers,
      body: JSON.stringify({
        inspection_id: inspectionId,
        result_status: verdict, result_note: note,
        visited_at: new Date().toISOString(),
        ...(geo ? { gps_lat: geo.lat, gps_lng: geo.lng, gps_accuracy: geo.acc } : {}),
        // Soil
        soil_color: soilColor || null, soil_texture: soilTexture || null,
        soil_drainage: soilDrainage || null, soil_moisture: soilMoisture || null,
        soil_issues: soilIssues.length ? soilIssues : [],
        soil_note: soilNote.trim() || null,
        // Cert
        cert_agency: hasCert ? certAgency.trim() || null : null,
        cert_number: hasCert ? certNumber.trim() || null : null,
        cert_issued_date:  hasCert && certIssuedDate  ? certIssuedDate  : null,
        cert_expires_date: hasCert && certExpiresDate ? certExpiresDate : null,
        // Lab
        lab_submitted:    hasLab,
        lab_name:         hasLab ? labName.trim() || null : null,
        lab_submitted_at: hasLab && labSubmittedAt ? labSubmittedAt : null,
        lab_tracking_no:  hasLab ? labTrackingNo.trim() || null : null,
      }),
    });

    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setSaving(false); setNotice({ ok: false, msg: d.error ?? 'บันทึกไม่สำเร็จ' }); return;
    }

    // Upload photos
    const sb = tryCreateSupabaseBrowserClient();
    const allPhotos: [File[], 'soil_cert' | 'soil_lab'][] = [
      [certPhotos, 'soil_cert'], [labPhotos, 'soil_lab'],
    ];
    let uploaded = 0;
    const total = allPhotos.reduce((s, [f]) => s + f.length, 0);

    if (total > 0 && memberId) {
      for (const [files, type] of allPhotos) {
        for (let i = 0; i < files.length; i++) {
          setUploadPct(Math.round((uploaded / total) * 100));
          await uploadPhoto(sb, memberId, inspectionId, files[i], type, i, geo, noBurnRequestId, plotId);
          uploaded++;
        }
      }
    }

    setUploadPct(null); setSaving(false);
    setNotice({ ok: true, msg: '✅ บันทึกผลการตรวจสำเร็จ' });
    onSuccess?.();
  }

  const verdictCfg = VERDICT_OPTS.find((v) => v.value === verdict);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Notice */}
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: notice.ok ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notice.ok ? '#86efac' : '#fca5a5'}`,
          color: notice.ok ? '#14532d' : '#991b1b',
          display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Context */}
      {(plotName || farmerName) && (
        <div style={{ ...S.section, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          {plotName   && <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>🌱 {plotName}</p>}
          {farmerName && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary,#4e5a53)' }}>👤 {farmerName}</p>}
        </div>
      )}

      {/* ── ผลการตรวจ ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>📋 ผลการตรวจ <span style={{ color: '#dc2626' }}>*</span></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {VERDICT_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setVerdict(opt.value)} style={{
              padding: '11px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              fontWeight: 600, fontSize: 14,
              border: `2px solid ${verdict === opt.value ? opt.color : '#e5e7eb'}`,
              background: verdict === opt.value ? opt.bg : '#fff',
              color: verdict === opt.value ? opt.color : '#374151',
            }}>{opt.label}</button>
          ))}
        </div>
        <label style={S.label}>
          บันทึกผลการตรวจ <span style={{ color: '#dc2626' }}>*</span>
          <textarea style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} rows={3}
            placeholder="สภาพแปลงโดยรวม สิ่งที่พบ เหตุผลของผล…"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      {/* ── A: ประเมินสภาพดิน ── */}
      <div style={S.section}>
        <p style={S.sectionTitle}>🪱 ประเมินสภาพดิน</p>

        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#4e5a53)' }}>สีดิน</p>
          <div style={S.chipRow}>
            {SOIL_COLORS.map((o) => (
              <button key={o.v} onClick={() => setSoilColor(soilColor === o.v ? '' : o.v)}
                style={S.chip(soilColor === o.v)}>{o.l}</button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#4e5a53)' }}>เนื้อดิน</p>
          <div style={S.chipRow}>
            {SOIL_TEXTURES.map((o) => (
              <button key={o.v} onClick={() => setSoilTexture(soilTexture === o.v ? '' : o.v)}
                style={S.chip(soilTexture === o.v)}>{o.l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#4e5a53)' }}>การระบายน้ำ</p>
            <div style={{ ...S.chipRow, flexDirection: 'column', gap: 5 }}>
              {SOIL_DRAINAGES.map((o) => (
                <button key={o.v} onClick={() => setSoilDrainage(soilDrainage === o.v ? '' : o.v)}
                  style={S.chip(soilDrainage === o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#4e5a53)' }}>ความชื้นดิน</p>
            <div style={{ ...S.chipRow, flexDirection: 'column', gap: 5 }}>
              {SOIL_MOISTURES.map((o) => (
                <button key={o.v} onClick={() => setSoilMoisture(soilMoisture === o.v ? '' : o.v)}
                  style={S.chip(soilMoisture === o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary,#4e5a53)' }}>ปัญหาที่พบ (เลือกได้หลายข้อ)</p>
          <div style={S.chipRow}>
            {SOIL_ISSUE_OPTS.map((o) => (
              <button key={o.v} onClick={() => toggleIssue(o.v)}
                style={S.chip(soilIssues.includes(o.v), '#dc2626')}>{o.l}</button>
            ))}
          </div>
        </div>

        <label style={S.label}>
          หมายเหตุเพิ่มเติม
          <textarea style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} rows={2}
            placeholder="สังเกตเพิ่มเติม เช่น กลิ่น ลักษณะพิเศษ…"
            value={soilNote} onChange={(e) => setSoilNote(e.target.value)} />
        </label>
      </div>

      {/* ── C: ใบรับรองหน่วยงาน ── */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={S.sectionTitle}>🏛️ ใบรับรองหน่วยงาน</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasCert} onChange={(e) => setHasCert(e.target.checked)} />
            มีใบรับรอง
          </label>
        </div>

        {hasCert && (
          <>
            <label style={S.label}>
              หน่วยงานที่ออกใบรับรอง
              <input style={S.input} value={certAgency}
                onChange={(e) => setCertAgency(e.target.value)}
                placeholder="เช่น กรมวิชาการเกษตร, อบต.ตำบลX" />
            </label>
            <label style={S.label}>
              เลขที่ใบรับรอง
              <input style={S.input} value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="เลขที่เอกสาร" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={S.label}>
                วันที่ออก
                <input style={S.input} type="date" value={certIssuedDate}
                  onChange={(e) => setCertIssuedDate(e.target.value)} />
              </label>
              <label style={S.label}>
                วันหมดอายุ
                <input style={S.input} type="date" value={certExpiresDate}
                  onChange={(e) => setCertExpiresDate(e.target.value)} />
              </label>
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
                📄 สแกน/ถ่ายรูปใบรับรอง
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary,#4e5a53)' }}> (สูงสุด 3 รูป)</span>
              </p>
              <input type="file" accept="image/*,application/pdf" capture="environment" multiple
                onChange={pickCertPhotos} disabled={certPhotos.length >= 3} />
              {certPhotos.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📷 {f.name}
                  </span>
                  <button onClick={() => setCertPhotos((p) => p.filter((_, j) => j !== i))}
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fafafa', cursor: 'pointer' }}>
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {!hasCert && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary,#4e5a53)' }}>
            ติ๊กถ้ามีใบรับรองจากหน่วยงานรัฐหรือองค์กรรับรอง
          </p>
        )}
      </div>

      {/* ── Lab: ส่งดินตรวจ ── */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={S.sectionTitle}>🧪 ส่งดินตรวจแล็บ</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasLab} onChange={(e) => setHasLab(e.target.checked)} />
            ส่งตรวจแล้ว
          </label>
        </div>

        {hasLab && (
          <>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                ⏳ สถานะ: รอผลการตรวจ
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#92400e' }}>
                admin จะอัปเดตผล pH / อินทรียวัตถุ เมื่อได้รับรายงานจากแล็บ
              </p>
            </div>
            <label style={S.label}>
              ห้องแล็บ / หน่วยงานที่ส่ง
              <input style={S.input} value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="เช่น กรมพัฒนาที่ดิน สถานีตรวจดินจังหวัดX" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={S.label}>
                วันที่ส่ง
                <input style={S.input} type="date" value={labSubmittedAt}
                  onChange={(e) => setLabSubmittedAt(e.target.value)} />
              </label>
              <label style={S.label}>
                เลขติดตาม (ถ้ามี)
                <input style={S.input} value={labTrackingNo}
                  onChange={(e) => setLabTrackingNo(e.target.value)}
                  placeholder="เลขตัวอย่าง" />
              </label>
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
                📦 รูปหลักฐาน (ถุงดิน/ใบนำส่ง)
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary,#4e5a53)' }}> (สูงสุด 3 รูป)</span>
              </p>
              <input type="file" accept="image/*" capture="environment" multiple
                onChange={pickLabPhotos} disabled={labPhotos.length >= 3} />
              {labPhotos.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📷 {f.name}
                  </span>
                  <button onClick={() => setLabPhotos((p) => p.filter((_, j) => j !== i))}
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fafafa', cursor: 'pointer' }}>
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {!hasLab && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary,#4e5a53)' }}>
            ติ๊กถ้ามีการเก็บตัวอย่างดินส่งห้องปฏิบัติการ
          </p>
        )}
      </div>

      {/* ── GPS ── */}
      <div style={{ ...S.section, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <UIButton variant="secondary" onClick={getGps} disabled={gpsLoad}>
          {gpsLoad ? '📡 กำลังดึง GPS…' : geo ? '📍 GPS แล้ว — อัปเดต' : '📍 บันทึก GPS ณ แปลง'}
        </UIButton>
        {geo && (
          <p style={{ margin: 0, fontSize: 11, color: '#059669', flex: 1 }}>
            {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
            <br />{geo.acc < 20 ? '🎯 แม่น' : `±${Math.round(geo.acc)} ม.`}
          </p>
        )}
      </div>

      {/* Upload progress */}
      {uploadPct !== null && (
        <div>
          <div style={{ height: 4, borderRadius: 2, background: '#e0e0e0' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#059669', width: `${uploadPct}%`, transition: 'width .3s' }} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary,#4e5a53)' }}>กำลังอัปโหลดรูป {uploadPct}%…</p>
        </div>
      )}

      {/* Submit */}
      <UIButton fullWidth loading={saving} disabled={saving || !verdict}
        onClick={submit}
        style={{ minHeight: 52, background: verdictCfg?.color }}>
        {saving ? 'กำลังบันทึก…' : verdictCfg ? `${verdictCfg.label} — บันทึก` : 'บันทึกผลการตรวจ'}
      </UIButton>

    </div>
  );
}
