'use client';

// QuickVisitForm — บันทึกการเยี่ยมภาคสนามอย่างรวดเร็ว
// สมาชิกเป็น optional — ระบุทีหลังได้
// flow: จับ GPS (auto) → ถ่ายรูป (optional) → กรอกสั้นๆ → บันทึก

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { compressFieldPhoto }            from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const PURPOSES = [
  { value: 'follow_up',      icon: '🌱', label: 'ติดตามปลูก' },
  { value: 'no_burn_advice', icon: '🌿', label: 'แนะนำไม่เผา' },
  { value: 'soil_check',     icon: '🪱', label: 'ตรวจดิน' },
  { value: 'pest_advice',    icon: '🐛', label: 'ศัตรูพืช' },
  { value: 'registration',   icon: '📋', label: 'ลงทะเบียน' },
  { value: 'problem_solve',  icon: '🔧', label: 'แก้ปัญหา' },
  { value: 'other',          icon: '💬', label: 'อื่นๆ' },
];

type GpsState = { lat: number; lng: number; accuracy: number } | null;
type MemberHit = { id: string; full_name: string; phone: string | null; province: string | null };

// ── Member search picker (ใช้ชื่อ/เบอร์/จังหวัด) ────────────────────────────
function MemberPicker({ onSelect, onSkip }: {
  onSelect: (m: MemberHit) => void;
  onSkip: () => void;
}) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<MemberHit[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(val: string) {
    setQ(val);
    if (val.length < 2) { setResults([]); return; }
    setLoading(true);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb.from('members')
      .select('id,full_name,phone,province')
      .eq('status', 'approved')
      .or(`full_name.ilike.%${val}%,phone.ilike.%${val}%,province.ilike.%${val}%`)
      .limit(10);
    setResults((data as MemberHit[]) ?? []);
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
        ค้นด้วยชื่อ เบอร์โทร หรือจังหวัด
      </p>
      <input
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="พิมพ์ชื่อ / เบอร์ / จังหวัด…"
        autoFocus
        style={{ padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }}
      />
      {loading && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>กำลังค้นหา…</p>}
      {results.map(m => (
        <button key={m.id} onClick={() => onSelect(m)}
          style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.full_name}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {m.phone ?? '—'}{m.province ? ` · ${m.province}` : ''}
          </span>
        </button>
      ))}
      <button onClick={onSkip}
        style={{ padding: '12px', borderRadius: 12, border: '2px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        ข้ามไปก่อน — ระบุทีหลัง
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export function QuickVisitForm() {
  const { member } = useAuth();
  const photoRef = useRef<HTMLInputElement>(null);

  // Step: 'gps' | 'member' | 'form' | 'done'
  const [step,      setStep]      = useState<'gps' | 'member' | 'form' | 'done'>('gps');
  const [gps,       setGps]       = useState<GpsState>(null);
  const [gpsErr,    setGpsErr]    = useState<string | null>(null);
  const [gpsLoading,setGpsLoading]= useState(false);

  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);

  const [purpose,    setPurpose]    = useState('follow_up');
  const [purposeNote,setPurposeNote]= useState('');
  const [note,       setNote]       = useState('');
  const [followUp,   setFollowUp]   = useState('');
  const [photos,     setPhotos]     = useState<File[]>([]);

  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);

  // Auto-capture GPS on mount
  useEffect(() => {
    captureGps();
  }, []);

  async function captureGps() {
    setGpsLoading(true); setGpsErr(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000 })
      );
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      setStep('member');
    } catch (e) {
      setGpsErr(e instanceof GeolocationPositionError ? e.message : String(e));
    }
    setGpsLoading(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    setPhotos(prev => [...prev, ...files].slice(0, 4));
    if (photoRef.current) photoRef.current.value = '';
  }

  async function handleSubmit() {
    if (!gps || !member?.member_id) return;
    setSaving(true); setSaveErr(null);

    const sb = tryCreateSupabaseBrowserClient();
    const sess = sb ? await sb.auth.getSession() : null;
    const token = sess?.data?.session?.access_token ?? null;
    if (!token) { setSaveErr('Session หมดอายุ กรุณา reload'); setSaving(false); return; }

    const form = new FormData();
    form.append('lat',          String(gps.lat));
    form.append('lng',          String(gps.lng));
    form.append('gps_lat',      String(gps.lat));
    form.append('gps_lng',      String(gps.lng));
    form.append('gps_accuracy', String(gps.accuracy));
    form.append('visit_purpose', purpose);
    if (purposeNote) form.append('visit_purpose_note', purposeNote);
    if (note)        form.append('note',        note);
    if (followUp)    form.append('follow_up',   followUp);
    if (selectedMember) form.append('member_id', selectedMember.id);
    // Compress all photos before upload
    const compressed = await Promise.all(photos.map(p => compressFieldPhoto(p)));
    compressed.forEach(({ processedFile }, i) => form.append(`photo_${i}`, processedFile));

    const res = await fetch('/api/field/visit-log', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });

    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setSaveErr(d.error ?? 'บันทึกไม่สำเร็จ'); return;
    }

    // Reset
    setStep('done');
    setTimeout(() => {
      setStep('gps'); setGps(null); setSelectedMember(null);
      setPurpose('follow_up'); setPurposeNote(''); setNote('');
      setFollowUp(''); setPhotos([]);
      captureGps();
    }, 2500);
  }

  // ── STEP: GPS ───────────────────────────────────────────────────────────────
  if (step === 'gps') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: 16 }}>
      <div style={{ fontSize: 52 }}>{gpsLoading ? '📡' : gpsErr ? '❌' : '📍'}</div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
        {gpsLoading ? 'กำลังจับพิกัด GPS…' : gpsErr ? 'จับ GPS ไม่สำเร็จ' : 'รอ GPS…'}
      </p>
      {gpsErr && (
        <>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{gpsErr}</p>
          <button onClick={captureGps}
            style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ลองใหม่
          </button>
          <button onClick={() => setStep('member')}
            style={{ padding: '10px 20px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
            ข้ามการจับ GPS
          </button>
        </>
      )}
    </div>
  );

  // ── STEP: MEMBER ────────────────────────────────────────────────────────────
  if (step === 'member') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {gps && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#166534', fontWeight: 600 }}>
          📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} ±{Math.round(gps.accuracy)}ม.
        </div>
      )}
      <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>ระบุสมาชิก (ถ้าทำได้)</p>
      <MemberPicker
        onSelect={m => { setSelectedMember(m); setStep('form'); }}
        onSkip={() => { setSelectedMember(null); setStep('form'); }}
      />
    </div>
  );

  // ── STEP: DONE ──────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', gap: 12 }}>
      <div style={{ fontSize: 56 }}>✅</div>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>บันทึกแล้ว!</p>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>กำลังเริ่มรายการใหม่…</p>
    </div>
  );

  // ── STEP: FORM ──────────────────────────────────────────────────────────────
  const INP = { padding: '10px 13px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>

      {/* Header info */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {gps && (
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: '#f0fdf4', color: '#166534', fontWeight: 600 }}>
            📍 ±{Math.round(gps.accuracy)}ม.
          </span>
        )}
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: selectedMember ? '#eff6ff' : '#f3f4f6', color: selectedMember ? '#1d4ed8' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setStep('member')}>
          👤 {selectedMember ? selectedMember.full_name : 'ยังไม่ระบุสมาชิก ✏️'}
        </span>
      </div>

      {/* วัตถุประสงค์ — big tap buttons */}
      <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>วัตถุประสงค์ *</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PURPOSES.map(p => (
          <button key={p.value} onClick={() => setPurpose(p.value)}
            style={{
              padding: '13px 8px', borderRadius: 12,
              border: `2px solid ${purpose === p.value ? '#2e7d32' : '#e5e7eb'}`,
              background: purpose === p.value ? '#e8f5e9' : '#fff',
              color: purpose === p.value ? '#1b5e20' : '#374151',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <span style={{ fontSize: 22 }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
      {purpose === 'other' && (
        <input style={INP} placeholder="ระบุวัตถุประสงค์" value={purposeNote} onChange={e => setPurposeNote(e.target.value)} />
      )}

      {/* Note */}
      <textarea style={{ ...INP, resize: 'vertical' }} rows={3}
        placeholder="📝 สรุปสิ่งที่พูดคุย / สิ่งที่พบ (ไม่บังคับ)"
        value={note} onChange={e => setNote(e.target.value)} />

      {/* Follow-up */}
      <textarea style={{ ...INP, resize: 'vertical', borderColor: '#fcd34d' }} rows={2}
        placeholder="⚡ สิ่งที่ต้องติดตาม (ไม่บังคับ)"
        value={followUp} onChange={e => setFollowUp(e.target.value)} />

      {/* Photos */}
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: photos.length ? 8 : 0 }}>
          {photos.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid #e5e7eb' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
              </div>
            );
          })}
        </div>
        <button onClick={() => photoRef.current?.click()} disabled={photos.length >= 4}
          style={{ width: '100%', padding: '11px', borderRadius: 12, border: '2px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          📷 เพิ่มรูป {photos.length > 0 ? `(${photos.length}/4)` : '(ไม่บังคับ)'}
        </button>
        <input ref={photoRef} type="file" accept="image/*" multiple capture="environment"
          style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>

      {saveErr && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{saveErr}</div>}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: saving ? '#d1fae5' : '#2e7d32', color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? '⏳ กำลังบันทึก…' : '✅ บันทึกการเยี่ยม'}
      </button>
    </div>
  );
}

