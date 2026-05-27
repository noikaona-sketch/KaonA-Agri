'use client';

import { useRef, useState } from 'react';

/* ── Types ── */
type PreviewRow = {
  rowNumber: number; full_name: string; phone: string | null;
  citizen_id_masked: string | null; district: string | null; province: string | null;
  bank_name: string | null; bank_account_number_masked: string | null;
  bank_account_name: string | null; line_user_id: string | null;
};
type DuplicateCandidate = {
  rowNumber: number; reasons: string[];
  existing: { id:string; full_name:string|null; phone:string|null }[];
};
type PreviewRes = {
  ok: boolean; errors: string[]; warnings: string[];
  rows: PreviewRow[];
  duplicateCandidates: DuplicateCandidate[];
  summary: { totalRows:number; validRows:number; invalidRows:number; duplicateRows:number };
};
type ConfirmRes = {
  ok: boolean; inserted: number; skipped: number;
  errors: string[]; insertedNames: string[];
};

type Step = 'upload' | 'preview' | 'done';

/* ── helpers ── */
function StepBadge({ n, label, active, done }: { n:number; label:string; active:boolean; done:boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800,
        background: done?'#D1FAE5':active?'#2D6A4F':'#F3F4F6',
        color:      done?'#065F46':active?'#fff':'#9CA3AF',
        border: `2px solid ${done?'#6EE7B7':active?'#2D6A4F':'#E5E7EB'}`,
        flexShrink:0 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize:13, fontWeight: active?700:400, color: active?'#111':'#9CA3AF' }}>{label}</span>
    </div>
  );
}

/* ── Main ── */
export function AdminImportCsv({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step,    setStep]    = useState<Step>('upload');
  const [file,    setFile]    = useState<File | null>(null);
  const [dragging,setDragging]= useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRes | null>(null);
  const [result,  setResult]  = useState<ConfirmRes | null>(null);
  const [overrideDup, setOverrideDup] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* ── drag & drop ── */
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) { setFile(f); setError(null); }
    else setError('กรุณาใช้ไฟล์ .csv เท่านั้น');
  }

  /* ── Step 1 → 2: preview ── */
  async function doPreview() {
    if (!file) return;
    setLoading(true); setError(null);
    const form = new FormData(); form.append('file', file);
    const res = await fetch('/api/admin/members/import/preview', {
      method:'POST', credentials:'include', body:form,
    });
    const d = (await res.json()) as PreviewRes;
    setLoading(false);
    if (!res.ok || !d.ok) { setError((d.errors ?? []).join(' · ') || 'preview ไม่สำเร็จ'); return; }
    setPreview(d); setStep('preview');
  }

  /* ── Step 2 → 3: confirm ── */
  async function doConfirm() {
    if (!file) return;
    setLoading(true); setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('overrideDuplicate', String(overrideDup));
    const res = await fetch('/api/admin/members/import/confirm', {
      method:'POST', credentials:'include', body:form,
    });
    const d = (await res.json()) as ConfirmRes;
    setLoading(false);
    if (!res.ok || !d.ok) { setError((d.errors ?? []).join(' · ') || 'import ไม่สำเร็จ'); return; }
    setResult(d); setStep('done');
  }

  function reset() {
    setStep('upload'); setFile(null); setPreview(null);
    setResult(null); setError(null); setOverrideDup(false);
    onDone?.();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Stepper ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', background:'#F9FAFB', borderRadius:10, border:'1px solid #E5E7EB' }}>
        <StepBadge n={1} label="อัปโหลด CSV" active={step==='upload'} done={step!=='upload'} />
        <div style={{ flex:1, height:1, background:'#E5E7EB' }}/>
        <StepBadge n={2} label="ตรวจสอบข้อมูล" active={step==='preview'} done={step==='done'} />
        <div style={{ flex:1, height:1, background:'#E5E7EB' }}/>
        <StepBadge n={3} label="นำเข้าสำเร็จ" active={step==='done'} done={false} />
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#DC2626', display:'flex', gap:8 }}>
          ❌ {error}
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Download template */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', background:'#EFF6FF', borderRadius:10, border:'1px solid #BFDBFE' }}>
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#1E40AF' }}>📋 Template CSV</p>
              <p style={{ margin:'2px 0 0', fontSize:12, color:'#3B82F6' }}>ดาวน์โหลด template แล้วกรอกข้อมูลสมาชิก</p>
            </div>
            <a href="/api/admin/members/import-template" download
              style={{ padding:'8px 16px', borderRadius:8, background:'#1E40AF', color:'#fff', fontSize:13, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
              ⬇️ ดาวน์โหลด template
            </a>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragging?'#2D6A4F':file?'#6EE7B7':'#D1D5DB'}`, borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background: dragging?'#F0FDF4':file?'#F0FDF4':'#FAFAFA', transition:'all .15s' }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={e => { const f=e.target.files?.[0]; if(f){setFile(f);setError(null);} }} />
            {file ? (
              <div>
                <div style={{ fontSize:36, marginBottom:8 }}>📄</div>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#065F46' }}>{file.name}</p>
                <p style={{ margin:'4px 0 0', fontSize:12, color:'#9CA3AF' }}>{(file.size/1024).toFixed(1)} KB · คลิกเพื่อเปลี่ยนไฟล์</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:40, marginBottom:8, opacity:.4 }}>📂</div>
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:'#374151' }}>ลากไฟล์ CSV มาวางที่นี่</p>
                <p style={{ margin:'4px 0 0', fontSize:12, color:'#9CA3AF' }}>หรือคลิกเพื่อเลือกไฟล์ · รองรับ .csv เท่านั้น</p>
              </div>
            )}
          </div>

          <button onClick={doPreview} disabled={!file || loading}
            style={{ padding:'11px', borderRadius:8, border:'none', background:file?'#2D6A4F':'#E5E7EB', color:file?'#fff':'#9CA3AF', fontWeight:700, fontSize:14, cursor:file?'pointer':'not-allowed', transition:'all .12s' }}>
            {loading ? '⏳ กำลังตรวจสอบ…' : '→ ตรวจสอบข้อมูล'}
          </button>
        </div>
      )}

      {/* ── STEP 2: Preview ── */}
      {step === 'preview' && preview && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'ทั้งหมด',    value:preview.summary.totalRows,     color:'#374151', bg:'#F9FAFB' },
              { label:'✅ นำเข้าได้', value:preview.summary.validRows,    color:'#059669', bg:'#F0FDF4' },
              { label:'⚠️ ซ้ำกัน',   value:preview.summary.duplicateRows, color:'#D97706', bg:'#FFFBEB' },
              { label:'❌ ข้อผิดพลาด',value:preview.summary.invalidRows,  color:'#DC2626', bg:'#FEF2F2' },
            ].map(c => (
              <div key={c.label} style={{ padding:'12px 16px', borderRadius:10, background:c.bg, border:`1px solid ${c.color}20`, textAlign:'center' }}>
                <p style={{ margin:0, fontSize:20, fontWeight:800, color:c.color }}>{c.value}</p>
                <p style={{ margin:'2px 0 0', fontSize:11, color:'#6B7280' }}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px' }}>
              <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#92400E' }}>⚠️ คำเตือน</p>
              {preview.warnings.map((w,i) => <p key={i} style={{ margin:'0 0 2px', fontSize:12, color:'#92400E' }}>· {w}</p>)}
            </div>
          )}

          {/* Duplicate warning */}
          {preview.duplicateCandidates.length > 0 && (
            <div style={{ background:'#FEF3C7', border:'1.5px solid #FCD34D', borderRadius:10, padding:'14px 16px' }}>
              <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:13, color:'#92400E' }}>⚠️ พบข้อมูลที่อาจซ้ำ {preview.duplicateCandidates.length} แถว</p>
              {preview.duplicateCandidates.slice(0,3).map(d => (
                <p key={d.rowNumber} style={{ margin:'0 0 3px', fontSize:12, color:'#92400E' }}>
                  · แถว {d.rowNumber}: {d.reasons.join(' · ')}
                </p>
              ))}
              {preview.duplicateCandidates.length > 3 && (
                <p style={{ fontSize:11, color:'#9CA3AF' }}>และอีก {preview.duplicateCandidates.length-3} แถว</p>
              )}
              <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, cursor:'pointer' }}>
                <input type="checkbox" checked={overrideDup} onChange={e=>setOverrideDup(e.target.checked)}
                  style={{ width:15, height:15, accentColor:'#D97706' }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#92400E' }}>นำเข้าทั้งหมดแม้มีข้อมูลซ้ำ</span>
              </label>
            </div>
          )}

          {/* Preview table */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>ตัวอย่างข้อมูล ({preview.rows.length} แถว)</span>
            </div>
            <div style={{ overflowX:'auto', maxHeight:320, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                <thead style={{ position:'sticky', top:0 }}>
                  <tr style={{ background:'#F9FAFB' }}>
                    {['#','ชื่อ-นามสกุล','เบอร์โทร','เลขบัตรฯ','จังหวัด','ธนาคาร'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => {
                    const isDup = preview.duplicateCandidates.some(d => d.rowNumber === r.rowNumber);
                    return (
                      <tr key={r.rowNumber} style={{ borderBottom:i<preview.rows.length-1?'1px solid #F3F4F6':'none', background:isDup?'#FFFBEB':'#fff' }}>
                        <td style={{ padding:'9px 14px', fontSize:11, color:'#9CA3AF' }}>
                          {isDup ? <span title="ข้อมูลอาจซ้ำ" style={{ color:'#D97706' }}>⚠️{r.rowNumber}</span> : r.rowNumber}
                        </td>
                        <td style={{ padding:'9px 14px', fontSize:12, fontWeight:600, color:'#111' }}>{r.full_name}</td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6B7280' }}>{r.phone ?? '—'}</td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6B7280', fontFamily:'monospace' }}>{r.citizen_id_masked ?? '—'}</td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6B7280' }}>{r.province ?? '—'}</td>
                        <td style={{ padding:'9px 14px', fontSize:12, color:'#6B7280' }}>{r.bank_name ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={() => { setStep('upload'); setPreview(null); setError(null); }}
              style={{ padding:'9px 20px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
              ← กลับ
            </button>
            <button onClick={doConfirm} disabled={loading || preview.summary.validRows === 0}
              style={{ padding:'9px 24px', borderRadius:8, border:'none', background: preview.summary.validRows>0?'#2D6A4F':'#E5E7EB', color: preview.summary.validRows>0?'#fff':'#9CA3AF', fontWeight:700, fontSize:13, cursor: preview.summary.validRows>0?'pointer':'not-allowed' }}>
              {loading ? '⏳ กำลังนำเข้า…' : `✅ นำเข้า ${preview.summary.validRows} รายการ`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 'done' && result && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, textAlign:'center', padding:'24px 0' }}>
          <div style={{ fontSize:52 }}>🎉</div>
          <div>
            <p style={{ margin:0, fontSize:20, fontWeight:800, color:'#065F46' }}>นำเข้าสำเร็จ!</p>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#6B7280' }}>
              เพิ่มสมาชิกใหม่ <strong style={{ color:'#059669' }}>{result.inserted} คน</strong>
              {result.skipped > 0 && ` · ข้ามซ้ำ ${result.skipped} คน`}
            </p>
          </div>
          {result.insertedNames.length > 0 && (
            <div style={{ background:'#F0FDF4', border:'1px solid #D1FAE5', borderRadius:10, padding:'14px 18px', textAlign:'left', maxHeight:200, overflowY:'auto' }}>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'#065F46' }}>รายชื่อที่นำเข้า:</p>
              {result.insertedNames.map((n,i) => <p key={i} style={{ margin:'0 0 2px', fontSize:12, color:'#374151' }}>✓ {n}</p>)}
            </div>
          )}
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={reset}
              style={{ padding:'10px 24px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
              นำเข้าเพิ่มเติม
            </button>
            <button onClick={() => { reset(); }}
              style={{ padding:'10px 24px', borderRadius:8, border:'none', background:'#2D6A4F', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              ✅ เสร็จสิ้น
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
