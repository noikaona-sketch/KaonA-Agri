'use client';
// QuickVisitForm v2 — Masterpiece-card pattern
// รูปหลายใบ + บันทึก + สมาชิกทีหลัง

import { useRef, useState }     from 'react';
import { useAuth }              from '@/providers/auth-provider';
import { getAuthHeaders }       from '@/lib/auth/get-auth-headers';
import { compressFieldPhoto }   from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

const PURPOSES = [
  { value: 'follow_up',      icon: '🌱', label: 'ติดตามปลูก' },
  { value: 'no_burn_advice', icon: '🌿', label: 'แนะนำไม่เผา' },
  { value: 'soil_check',     icon: '🪱', label: 'ตรวจดิน' },
  { value: 'pest_advice',    icon: '🐛', label: 'ศัตรูพืช' },
  { value: 'registration',   icon: '📋', label: 'ลงทะเบียน' },
  { value: 'problem_solve',  icon: '🔧', label: 'แก้ปัญหา' },
  { value: 'other',          icon: '💬', label: 'อื่นๆ' },
];

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

type MemberHit = { id: string; full_name: string; phone: string | null; province: string | null };

function MemberSearch({ onSelect, onSkip }: {
  onSelect: (m: MemberHit) => void;
  onSkip: () => void;
}) {
  const [q, setQ]           = useState('');
  const [results, setRes]   = useState<MemberHit[]>([]);
  const [loading, setLoad]  = useState(false);

  async function search(val: string) {
    setQ(val);
    if (val.length < 2) { setRes([]); return; }
    setLoad(true);
    const sb = tryCreateSupabaseBrowserClient();
    const { data } = await sb!.from('members').select('id,full_name,phone,province')
      .eq('status','approved').or(`full_name.ilike.%${val}%,phone.ilike.%${val}%,province.ilike.%${val}%`).limit(8);
    setRes((data as MemberHit[]) ?? []);
    setLoad(false);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <input value={q} onChange={e => search(e.target.value)} autoFocus
        placeholder="ชื่อ / เบอร์ / จังหวัด…"
        style={{ padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:15, fontFamily:'inherit' }} />
      {loading && <p style={{ margin:0, fontSize:12, color:'#9ca3af' }}>ค้นหา…</p>}
      {results.map(m => (
        <button key={m.id} onClick={() => onSelect(m)}
          style={{ padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'#fff', textAlign:'left', cursor:'pointer' }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{m.full_name}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{m.phone ?? '—'}{m.province ? ` · ${m.province}` : ''}</div>
        </button>
      ))}
      <button onClick={onSkip}
        style={{ padding:'11px', borderRadius:12, border:'2px dashed #d1d5db', background:'#f9fafb', color:'#6b7280', fontSize:13, fontWeight:600, cursor:'pointer' }}>
        ข้ามไปก่อน — ระบุสมาชิกทีหลัง
      </button>
    </div>
  );
}

function PhotoGrid({ photos, onAdd, onRemove }: {
  photos: File[]; onAdd: () => void; onRemove: (i: number) => void;
}) {
  const sb = tryCreateSupabaseBrowserClient();
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {photos.map((f, i) => {
        const url = URL.createObjectURL(f);
        return (
          <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:10, overflow:'hidden', border:'1.5px solid #e5e7eb', flexShrink:0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <button onClick={() => onRemove(i)}
              style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>✕</button>
          </div>
        );
      })}
      {photos.length < 8 && (
        <button onClick={onAdd}
          style={{ width:72, height:72, borderRadius:10, border:'2px dashed #d1d5db', background:'#f9fafb', color:'#9ca3af', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          +
        </button>
      )}
    </div>
  );
}

export function QuickVisitForm() {
  const { member } = useAuth();
  const fileRef    = useRef<HTMLInputElement>(null);

  const [step,    setStep]    = useState<'member'|'form'|'done'>('member');
  const [selMember, setSelMember] = useState<MemberHit | null>(null);

  // GPS — auto on mount via useEffect not available here, manual trigger
  const [gps,     setGps]     = useState<{ lat:number; lng:number; acc:number } | null>(null);
  const [gpsLoad, setGpsLoad] = useState(false);
  const [gpsErr,  setGpsErr]  = useState<string|null>(null);

  const [purpose,  setPurpose]  = useState('follow_up');
  const [purposeNote, setPurposeNote] = useState('');
  const [note,     setNote]     = useState('');
  const [followUp, setFollowUp] = useState('');
  const [photos,   setPhotos]   = useState<File[]>([]);

  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState<string|null>(null);
  const [notice,   setNotice]   = useState<string|null>(null);

  async function captureGps() {
    setGpsLoad(true); setGpsErr(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat:pos.coords.latitude, lng:pos.coords.longitude, acc:pos.coords.accuracy }); setGpsLoad(false); },
      err => { setGpsErr(err.message); setGpsLoad(false); },
      { enableHighAccuracy:true, timeout:12000 }
    );
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 8 - photos.length);
    setPhotos(prev => [...prev, ...files].slice(0, 8));
    if (fileRef.current) fileRef.current.value = '';
    if (!gps && files[0]) {
      // try EXIF GPS
      try {
        const buf = await files[0].arrayBuffer();
        const view = new DataView(buf);
        // simple EXIF check — skip if not JPEG
        if (view.getUint16(0) === 0xFFD8) {
          // GPS extraction would go here — auto-set if found
        }
      } catch { /* skip */ }
    }
  }

  async function handleSubmit() {
    if (!member?.member_id) return;
    setSaving(true); setSaveErr(null);

    const { headers, url } = await getAuthHeaders(member, '/api/field/visit-log');
    const form = new FormData();
    form.append('visit_purpose', purpose);
    if (purposeNote) form.append('visit_purpose_note', purposeNote);
    if (note)        form.append('note', note);
    if (followUp)    form.append('follow_up', followUp);
    if (gps) {
      form.append('gps_lat', String(gps.lat));
      form.append('gps_lng', String(gps.lng));
      form.append('gps_accuracy', String(gps.acc));
    }
    if (selMember) form.append('member_id', selMember.id);

    const compressed = await Promise.all(photos.map(p => compressFieldPhoto(p)));
    compressed.forEach(({ processedFile }, i) => form.append(`photo_${i}`, processedFile));

    const res = await fetch(url, { method:'POST', headers, body:form });
    const data = (await res.json()) as { ok?:boolean; error?:string };
    setSaving(false);
    if (!res.ok) { setSaveErr(data.error ?? 'บันทึกไม่สำเร็จ'); return; }

    setNotice('✅ บันทึกแล้ว');
    setTimeout(() => {
      setStep('member'); setSelMember(null); setGps(null);
      setPurpose('follow_up'); setPurposeNote(''); setNote('');
      setFollowUp(''); setPhotos([]); setNotice(null);
    }, 2000);
  }

  const INP = { padding:'10px 13px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' };
  const SEC = { fontWeight:800 as const, fontSize:13, color:'#374151', margin:'0 0 6px' };

  // ── DONE ──
  if (notice) return (
    <div style={{ textAlign:'center', padding:'32px 16px' }}>
      <div style={{ fontSize:48, marginBottom:8 }}>✅</div>
      <p style={{ fontWeight:800, fontSize:16 }}>{notice}</p>
    </div>
  );

  // ── Header ──
  const Header = (
    <div style={{ background:'linear-gradient(135deg,#1b5e20,#2e7d32)', padding:'14px 18px' }}>
      <p style={{ margin:0, fontSize:13, color:'#a7f3d0' }}>ทีมภาคสนาม</p>
      <p style={{ margin:'2px 0 0', fontWeight:900, fontSize:17, color:'#fff' }}>🤝 บันทึกการเยี่ยม</p>
    </div>
  );

  // ── STEP: MEMBER ──
  if (step === 'member') return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb' }}>
      {Header}
      <div style={{ padding:16 }}>
        <p style={{ margin:'0 0 12px', fontWeight:700, fontSize:14 }}>ระบุสมาชิก (ถ้าทำได้)</p>
        <MemberSearch
          onSelect={m => { setSelMember(m); setStep('form'); if (!gps) captureGps(); }}
          onSkip={() => { setSelMember(null); setStep('form'); if (!gps) captureGps(); }}
        />
      </div>
    </div>
  );

  // ── STEP: FORM ──
  return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb' }}>
      {Header}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

        {/* Info bar */}
        <div style={{ padding:'10px 16px', background:'#f8fafc', borderBottom:'1px solid #f3f4f6', display:'flex', gap:8, flexWrap:'wrap' }}>
          {gps ? (
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'#f0fdf4', color:'#166534', fontWeight:700 }}>
              📍 ±{Math.round(gps.acc)}ม.
            </span>
          ) : (
            <button onClick={captureGps} disabled={gpsLoad}
              style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151' }}>
              {gpsLoad ? '⏳ GPS…' : '📡 จับ GPS'}
            </button>
          )}
          <button onClick={() => { setStep('member'); }}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background: selMember ? '#eff6ff' : '#f3f4f6', color: selMember ? '#1d4ed8' : '#6b7280', border:'none', cursor:'pointer', fontWeight: selMember ? 700 : 400 }}>
            👤 {selMember ? selMember.full_name : 'ยังไม่ระบุสมาชิก ✏️'}
          </button>
        </div>

        {/* Purpose */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={SEC}>วัตถุประสงค์ *</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            {PURPOSES.map(p => (
              <button key={p.value} onClick={() => setPurpose(p.value)}
                style={{ padding:'10px 8px', borderRadius:12, border:`2px solid ${purpose===p.value?'#2e7d32':'#e5e7eb'}`, background:purpose===p.value?'#e8f5e9':'#fff', color:purpose===p.value?'#1b5e20':'#374151', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:18 }}>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
          {purpose==='other' && (
            <input style={{ ...INP, marginTop:8 }} placeholder="ระบุวัตถุประสงค์" value={purposeNote} onChange={e => setPurposeNote(e.target.value)} />
          )}
        </div>

        {/* Photos */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ ...SEC, marginBottom:8 }}>📷 รูปภาพ {photos.length > 0 ? `(${photos.length}/8)` : '(ไม่บังคับ)'}</p>
          <PhotoGrid photos={photos} onAdd={() => fileRef.current?.click()} onRemove={i => setPhotos(prev => prev.filter((_,j) => j!==i))} />
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
            style={{ display:'none' }} onChange={handlePhotos} />
        </div>

        {/* Notes */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={SEC}>📝 บันทึก / สรุปการพูดคุย</p>
          <textarea style={{ ...INP, resize:'vertical' }} rows={3}
            placeholder="สิ่งที่พูดคุย สิ่งที่พบ…" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ ...SEC, color:'#d97706' }}>⚡ สิ่งที่ต้องติดตาม</p>
          <textarea style={{ ...INP, resize:'vertical', borderColor:'#fcd34d' }} rows={2}
            placeholder="งานค้าง / นัดหมายครั้งต่อไป…" value={followUp} onChange={e => setFollowUp(e.target.value)} />
        </div>

        {saveErr && <div style={{ margin:'0 16px 12px', padding:'10px', borderRadius:10, background:'#fff1f2', color:'#9f1239', fontSize:13 }}>{saveErr}</div>}

        {/* Submit */}
        <div style={{ padding:'14px 16px' }}>
          <button onClick={handleSubmit} disabled={saving}
            style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:saving?'#e5e7eb':'#1b5e20', color:saving?'#9ca3af':'#fff', fontSize:15, fontWeight:800, cursor:saving?'not-allowed':'pointer' }}>
            {saving ? '⏳ กำลังบันทึก…' : '✅ บันทึกการเยี่ยม'}
          </button>
        </div>
      </div>
    </div>
  );
}
