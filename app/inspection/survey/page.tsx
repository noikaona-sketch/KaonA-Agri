'use client';
// FieldSurveyForm v2 — Masterpiece pattern
// รวม "สำรวจไร่" + "ยืนยันไม่เผา" ในหน้าเดียว
// inspector/admin เท่านั้น, สมาชิกระบุทีหลังได้

import { useRef, useState }        from 'react';
import { useAuth }                 from '@/providers/auth-provider';
import { MobileAppShell }          from '@/shared/components/mobile-app-shell';
import { LoadingState }            from '@/shared/components/loading-state';
import { ProtectedRoute }          from '@/shared/components/protected-route';
import { getAuthHeaders }          from '@/lib/auth/get-auth-headers';
import { compressFieldPhoto }      from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type SurveyMode = 'field' | 'noburn';
type MemberHit  = { id: string; full_name: string; phone: string | null; province: string | null };

const CROP_TYPES = [
  { value:'corn',      label:'🌽 ข้าวโพด' },
  { value:'rice',      label:'🌾 ข้าว' },
  { value:'cassava',   label:'🍠 มัน' },
  { value:'sugarcane', label:'🎋 อ้อย' },
  { value:'other',     label:'🌿 อื่นๆ' },
];

const GROWTH_STAGES = [
  { value:'seedling',  label:'ต้นกล้า',    days:'7–21 วัน' },
  { value:'vegetative',label:'เจริญเติบโต', days:'21–45 วัน' },
  { value:'tasseling', label:'ออกดอก',      days:'45–55 วัน' },
  { value:'silking',   label:'ออกไหม',      days:'55–65 วัน' },
  { value:'grain_fill',label:'เมล็ดพัฒนา', days:'65–90 วัน' },
  { value:'maturity',  label:'แก่/สุก',    days:'90–110 วัน' },
];

const CONDITIONS = [
  { value:'healthy',     label:'✅ ปกติ',       color:'#166534', bg:'#f0fdf4', border:'#86efac' },
  { value:'stressed',    label:'⚠️ อาการเครียด', color:'#92400e', bg:'#fffbeb', border:'#fcd34d' },
  { value:'pest_damage', label:'🐛 ศัตรูพืช',   color:'#9f1239', bg:'#fff1f2', border:'#fda4af' },
  { value:'disease',     label:'🦠 โรคพืช',     color:'#6d28d9', bg:'#faf5ff', border:'#c4b5fd' },
  { value:'drought',     label:'🌵 แล้ง',        color:'#c2410c', bg:'#fff7ed', border:'#fdba74' },
];

const NOBURN_EVIDENCE = [
  { value:'mulching',   label:'🌾 คลุมฟาง' },
  { value:'incorporated',label:'🚜 ไถกลบ' },
  { value:'compost',    label:'♻️ ทำปุ๋ย' },
  { value:'cleared',    label:'✅ เก็บออก' },
  { value:'other',      label:'💬 อื่นๆ' },
];

// ── Member Search ──────────────────────────────────────────────────────────────
function MemberSearch({ onSelect, onSkip }: {
  onSelect: (m: MemberHit) => void; onSkip: () => void;
}) {
  const [q, setQ]    = useState('');
  const [res, setRes]= useState<MemberHit[]>([]);
  const [load, setLoad] = useState(false);

  async function search(val: string) {
    setQ(val);
    if (val.length < 2) { setRes([]); return; }
    setLoad(true);
    const sb = tryCreateSupabaseBrowserClient();
    const { data } = await sb!.from('members').select('id,full_name,phone,province')
      .eq('status','approved').or(`full_name.ilike.%${val}%,phone.ilike.%${val}%`).limit(8);
    setRes((data as MemberHit[]) ?? []);
    setLoad(false);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <input value={q} onChange={e => search(e.target.value)} autoFocus
        placeholder="ชื่อ / เบอร์ / จังหวัด…"
        style={{ padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:15, fontFamily:'inherit' }} />
      {load && <p style={{ margin:0, fontSize:12, color:'#9ca3af' }}>ค้นหา…</p>}
      {res.map(m => (
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

// ── Main Form ──────────────────────────────────────────────────────────────────
function SurveyFormContent() {
  const { status } = useAuth();
  const { member } = useAuth();
  const fileRef    = useRef<HTMLInputElement>(null);

  const [mode,       setMode]       = useState<SurveyMode>('field');
  const [step,       setStep]       = useState<'member'|'form'|'done'>('member');
  const [selMember,  setSelMember]  = useState<MemberHit|null>(null);

  // GPS
  const [gps,     setGps]     = useState<{ lat:number; lng:number; acc:number }|null>(null);
  const [gpsLoad, setGpsLoad] = useState(false);
  const [gpsErr,  setGpsErr]  = useState<string|null>(null);

  // Field survey fields
  const [cropType,    setCropType]    = useState('corn');
  const [cropNote,    setCropNote]    = useState('');
  const [stage,       setStage]       = useState('');
  const [ageDays,     setAgeDays]     = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [condition,   setCondition]   = useState('');
  const [condNote,    setCondNote]    = useState('');

  // No-burn fields
  const [nbEvidence,  setNbEvidence]  = useState('');
  const [nbNote,      setNbNote]      = useState('');

  // Common
  const [note,     setNote]     = useState('');
  const [photos,   setPhotos]   = useState<File[]>([]);

  // Submit
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string|null>(null);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;

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
      // EXIF GPS extraction
      try {
        const buf = await files[0].arrayBuffer();
        const view = new DataView(buf.slice(0, 65536));
        if (view.getUint16(0) === 0xFFD8) {
          let offset = 2;
          while (offset < view.byteLength - 4) {
            if (view.getUint16(offset) === 0xFFE1) {
              const hdr = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
              if (hdr === 'Exif') {
                const t = offset + 10;
                const le = view.getUint16(t) === 0x4949;
                const r16 = (o: number) => le ? view.getUint16(t+o,true) : view.getUint16(t+o);
                const r32 = (o: number) => le ? view.getUint32(t+o,true) : view.getUint32(t+o);
                const ifd0 = r32(4); const n = r16(ifd0);
                let gpsOff = 0;
                for (let i = 0; i < n; i++) if (r16(ifd0+2+i*12) === 0x8825) { gpsOff = r32(ifd0+2+i*12+8); break; }
                if (gpsOff) {
                  const gn = r16(gpsOff); let latRef='', lngRef='', latR: number[]=[], lngR: number[]=[];
                  for (let i = 0; i < gn; i++) {
                    const b = gpsOff+2+i*12; const tag = r16(b); const cnt = r32(b+4); const vo = b+8;
                    if (tag===1) latRef = String.fromCharCode(view.getUint8(t+r32(vo)));
                    else if (tag===3) lngRef = String.fromCharCode(view.getUint8(t+r32(vo)));
                    else if ((tag===2||tag===4) && r16(b+2)===5) {
                      const d = r32(vo); const rats: number[] = [];
                      for (let j=0;j<cnt;j++) rats.push(r32(d+j*8+0) / (r32(d+j*8+4)||1));
                      if (tag===2) latR=rats; else lngR=rats;
                    }
                  }
                  if (latR.length>=3 && lngR.length>=3) {
                    let lat = latR[0]+latR[1]/60+latR[2]/3600;
                    let lng = lngR[0]+lngR[1]/60+lngR[2]/3600;
                    if (latRef==='S') lat=-lat; if (lngRef==='W') lng=-lng;
                    if (lat||lng) setGps({ lat, lng, acc:10 });
                  }
                }
              }
            }
            offset += 2 + view.getUint16(offset+2);
          }
        }
      } catch { /* skip */ }
    }
  }

  async function handleSubmit() {
    if (!member?.member_id || !gps) return;
    setSaving(true); setSaveErr(null);

    const { headers, url } = await getAuthHeaders(member, '/api/field/survey-observation');
    const form = new FormData();
    form.append('lat',     String(gps.lat));
    form.append('lng',     String(gps.lng));
    form.append('accuracy',String(gps.acc));
    form.append('activity_context', mode);

    if (mode === 'field') {
      form.append('crop_type', cropType);
      if (cropNote)   form.append('crop_type_note', cropNote);
      if (stage)      form.append('growth_stage', stage);
      if (ageDays)    form.append('estimated_age_days', ageDays);
      if (areaRai)    form.append('estimated_area_rai', areaRai);
      if (condition)  form.append('plant_condition', condition);
      if (condNote)   form.append('condition_note', condNote);
    } else {
      form.append('crop_type', cropType);
      form.append('note', `[ยืนยันไม่เผา] หลักฐาน: ${nbEvidence} | ${nbNote}`.trim());
    }

    if (note) form.append('note', note);
    if (selMember) form.append('member_id', selMember.id);

    const compressed = await Promise.all(photos.map(p => compressFieldPhoto(p)));
    compressed.forEach(({ processedFile }, i) => form.append(`photo_${i}`, processedFile));

    const res = await fetch(url, { method:'POST', headers, body:form });
    const data = (await res.json()) as { ok?:boolean; error?:string };
    setSaving(false);
    if (!res.ok) { setSaveErr(data.error ?? 'บันทึกไม่สำเร็จ'); return; }

    setStep('done');
    setTimeout(() => {
      setStep('member'); setSelMember(null); setGps(null);
      setCropType('corn'); setStage(''); setAgeDays('');
      setAreaRai(''); setCondition(''); setNote('');
      setPhotos([]); setNbEvidence(''); setNbNote('');
    }, 2500);
  }

  const INP = { padding:'10px 13px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' };
  const SEC = { fontWeight:800 as const, fontSize:13, color:'#374151', margin:'0 0 8px' };
  const BLUE = '#185FA5';
  const HBLUE = '#0C447C';

  if (step === 'done') return (
    <div style={{ textAlign:'center', padding:'40px 16px' }}>
      <div style={{ fontSize:52, marginBottom:8 }}>✅</div>
      <p style={{ fontWeight:800, fontSize:17 }}>บันทึกแล้ว!</p>
      <p style={{ fontSize:13, color:'#6b7280' }}>กำลังเริ่มรายการใหม่…</p>
    </div>
  );

  const Header = (
    <div style={{ background:`linear-gradient(135deg,${HBLUE},${BLUE})`, padding:'14px 18px' }}>
      <p style={{ margin:0, fontSize:13, color:'#B5D4F4' }}>ผู้ตรวจ</p>
      <p style={{ margin:'2px 0 0', fontWeight:900, fontSize:17, color:'#fff' }}>📋 สำรวจพื้นที่</p>
    </div>
  );

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

  return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb' }}>
      {Header}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

        {/* Info bar */}
        <div style={{ padding:'10px 16px', background:'#f0f7ff', borderBottom:'1px solid #e0ecff', display:'flex', gap:8, flexWrap:'wrap' }}>
          {gps ? (
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'#e3f2fd', color:HBLUE, fontWeight:700 }}>
              📍 ±{Math.round(gps.acc)}ม.
            </span>
          ) : (
            <button onClick={captureGps} disabled={gpsLoad}
              style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:`1px solid ${BLUE}`, background:'#fff', cursor:'pointer', color:BLUE, fontWeight:700 }}>
              {gpsLoad ? '⏳ GPS…' : '📡 จับ GPS *'}
            </button>
          )}
          <button onClick={() => setStep('member')}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:selMember?'#eff6ff':'#f3f4f6', color:selMember?HBLUE:'#6b7280', border:'none', cursor:'pointer', fontWeight:selMember?700:400 }}>
            👤 {selMember ? selMember.full_name : 'ยังไม่ระบุสมาชิก ✏️'}
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={SEC}>ประเภทการสำรวจ</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button onClick={() => setMode('field')}
              style={{ padding:'12px 10px', borderRadius:12, border:`2px solid ${mode==='field'?BLUE:'#e5e7eb'}`, background:mode==='field'?'#e3f2fd':'#fff', color:mode==='field'?HBLUE:'#374151', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              🌾 สำรวจแปลง
            </button>
            <button onClick={() => setMode('noburn')}
              style={{ padding:'12px 10px', borderRadius:12, border:`2px solid ${mode==='noburn'?'#2e7d32':'#e5e7eb'}`, background:mode==='noburn'?'#e8f5e9':'#fff', color:mode==='noburn'?'#1b5e20':'#374151', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              🌿 ยืนยันไม่เผา
            </button>
          </div>
        </div>

        {/* Crop type — common to both modes */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={SEC}>ชนิดพืช</p>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {CROP_TYPES.map(c => (
              <button key={c.value} onClick={() => setCropType(c.value)}
                style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${cropType===c.value?BLUE:'#e5e7eb'}`, background:cropType===c.value?'#e3f2fd':'#fff', color:cropType===c.value?HBLUE:'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {c.label}
              </button>
            ))}
          </div>
          {cropType==='other' && (
            <input style={{ ...INP, marginTop:8 }} placeholder="ระบุชนิดพืช" value={cropNote} onChange={e => setCropNote(e.target.value)} />
          )}
        </div>

        {/* Field-specific fields */}
        {mode === 'field' && (
          <>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
              <p style={SEC}>ระยะการเจริญเติบโต</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                {GROWTH_STAGES.map(s => (
                  <button key={s.value} onClick={() => setStage(stage===s.value?'':s.value)}
                    style={{ padding:'9px 10px', borderRadius:10, border:`1.5px solid ${stage===s.value?BLUE:'#e5e7eb'}`, background:stage===s.value?'#e3f2fd':'#fff', color:stage===s.value?HBLUE:'#374151', fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'left' }}>
                    <div>{s.label}</div>
                    <div style={{ fontSize:10, color:stage===s.value?BLUE:'#9ca3af', fontWeight:400 }}>{s.days}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <label style={{ display:'grid', gap:4, fontSize:12, fontWeight:700 }}>อายุโดยประมาณ (วัน)
                  <input style={INP} type="number" min="0" value={ageDays} onChange={e => setAgeDays(e.target.value)} placeholder="เช่น 54" />
                </label>
                <label style={{ display:'grid', gap:4, fontSize:12, fontWeight:700 }}>พื้นที่ (ไร่)
                  <input style={INP} type="number" step="0.5" min="0" value={areaRai} onChange={e => setAreaRai(e.target.value)} placeholder="เช่น 5" />
                </label>
              </div>
            </div>

            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
              <p style={SEC}>สภาพพืช</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {CONDITIONS.map(c => (
                  <button key={c.value} onClick={() => setCondition(condition===c.value?'':c.value)}
                    style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${condition===c.value?c.border:'#e5e7eb'}`, background:condition===c.value?c.bg:'#fff', color:condition===c.value?c.color:'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {c.label}
                  </button>
                ))}
              </div>
              {condition && condition!=='healthy' && (
                <input style={{ ...INP, marginTop:8 }} placeholder="รายละเอียด…" value={condNote} onChange={e => setCondNote(e.target.value)} />
              )}
            </div>
          </>
        )}

        {/* No-burn specific */}
        {mode === 'noburn' && (
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
            <p style={SEC}>หลักฐานการไม่เผา</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              {NOBURN_EVIDENCE.map(e => (
                <button key={e.value} onClick={() => setNbEvidence(nbEvidence===e.value?'':e.value)}
                  style={{ padding:'10px', borderRadius:10, border:`1.5px solid ${nbEvidence===e.value?'#2e7d32':'#e5e7eb'}`, background:nbEvidence===e.value?'#e8f5e9':'#fff', color:nbEvidence===e.value?'#1b5e20':'#374151', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {e.label}
                </button>
              ))}
            </div>
            <textarea style={{ ...INP, marginTop:10, resize:'vertical' }} rows={2}
              placeholder="หมายเหตุเพิ่มเติม…" value={nbNote} onChange={e => setNbNote(e.target.value)} />
          </div>
        )}

        {/* Photos */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ ...SEC, marginBottom:8 }}>📷 รูปภาพ {photos.length > 0 ? `(${photos.length}/8)` : '(ไม่บังคับ)'}</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {photos.map((f, i) => {
              const url = URL.createObjectURL(f);
              return (
                <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:10, overflow:'hidden', border:'1.5px solid #e5e7eb', flexShrink:0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))}
                    style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>✕</button>
                </div>
              );
            })}
            {photos.length < 8 && (
              <button onClick={() => fileRef.current?.click()}
                style={{ width:72, height:72, borderRadius:10, border:'2px dashed #d1d5db', background:'#f9fafb', color:'#9ca3af', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                +
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
            style={{ display:'none' }} onChange={handlePhotos} />
        </div>

        {/* Common note */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={SEC}>📝 บันทึกเพิ่มเติม</p>
          <textarea style={{ ...INP, resize:'vertical' }} rows={3}
            placeholder="สิ่งที่สังเกต / หมายเหตุ…" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {!gps && <p style={{ margin:'0 16px 4px', fontSize:12, color:'#dc2626', fontWeight:600 }}>* ต้องจับพิกัด GPS ก่อนบันทึก</p>}
        {saveErr && <div style={{ margin:'0 16px 8px', padding:'10px', borderRadius:10, background:'#fff1f2', color:'#9f1239', fontSize:13 }}>{saveErr}</div>}

        <div style={{ padding:'14px 16px' }}>
          <button onClick={handleSubmit} disabled={saving || !gps}
            style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:(!gps||saving)?'#e5e7eb':BLUE, color:(!gps||saving)?'#9ca3af':'#fff', fontSize:15, fontWeight:800, cursor:(!gps||saving)?'not-allowed':'pointer' }}>
            {saving ? '⏳ กำลังบันทึก…' : mode==='field' ? '📋 บันทึกการสำรวจ' : '🌿 บันทึกยืนยันไม่เผา'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FieldSurveyPage() {
  return (
    <ProtectedRoute allowedRoles={['inspector','admin']}>
      <MobileAppShell title="📋 สำรวจพื้นที่" subtitle="บันทึกการสำรวจและยืนยันไม่เผา">
        <SurveyFormContent />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
