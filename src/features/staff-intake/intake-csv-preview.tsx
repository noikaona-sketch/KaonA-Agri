'use client';
import { useState } from 'react';
type V={row:number;scale_ticket_no:string;member_phone:string;gross_weight_kg:number;moisture_pct:number;weigh_at:string;location_name:string;quality_grade:string};
type E={row:number;scale_ticket_no:string;reason:string;detail:string};
export function IntakeCsvPreview(){
  const [csv,setCsv]=useState('scale_ticket_no,member_phone,gross_weight_kg,moisture_pct,weigh_at,location_name,quality_grade\n');
  const [valid,setValid]=useState<V[]>([]), [errors,setErrors]=useState<E[]>([]), [commitErrors,setCommitErrors]=useState<E[]>([]), [loading,setLoading]=useState(false), [msg,setMsg]=useState(''), [previewReady,setPreviewReady]=useState(false);
  async function run(action:'preview'|'commit'){
    setLoading(true); setMsg('');
    const r=await fetch(`/api/intake/csv-import?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv})});
    const d=await r.json() as {valid?:V[];errors?:E[];commitErrors?:E[];committed?:number;error?:string}; setLoading(false);
    if(!r.ok){setMsg(`❌ ${d.error??'error'}`); return;}
    setValid(d.valid??[]); setErrors(d.errors??[]); setCommitErrors(d.commitErrors??[]);
    if(action==='preview'){setPreviewReady(true); setMsg('✅ ตรวจสอบแล้ว');}
    else setMsg(`✅ บันทึกสำเร็จ ${d.committed??0} รายการ`);
  }
  function onCsvChange(v:string){setCsv(v); setValid([]); setErrors([]); setCommitErrors([]); setPreviewReady(false); setMsg('');}
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div className="kaona-card" style={{display:'flex',flexDirection:'column',gap:8}}>
      <p style={{margin:0,fontWeight:600}}>CSV Import (Preview → Commit)</p>
      <textarea className="reg-input" value={csv} onChange={e=>onCsvChange(e.target.value)} rows={8} style={{fontFamily:'monospace'}} />
      <div style={{display:'flex',gap:8}}>
        <button className="admin-btn admin-btn--secondary" onClick={()=>run('preview')} disabled={loading}>{loading?'...':'🔍 Preview'}</button>
        <button className="admin-btn admin-btn--primary" onClick={()=>run('commit')} disabled={loading||!previewReady||valid.length===0}>✅ Commit</button>
      </div>
      {msg&&<p style={{margin:0,fontSize:13}}>{msg}</p>}
      <p style={{margin:0,fontSize:13}}>Summary: ✅ {valid.length} valid, ❌ {errors.length} errors, ⚠️ commit errors {commitErrors.length}</p>
    </div>
    {valid.length>0&&<div className="kaona-card"><p style={{margin:'0 0 8px',fontWeight:600}}>ตัวอย่าง valid rows</p>{valid.slice(0,5).map(v=><div key={`${v.row}-${v.scale_ticket_no}`} style={{fontSize:13,padding:'4px 0',borderBottom:'1px solid #eee'}}>row {v.row} · {v.scale_ticket_no} · {v.member_phone} · {v.location_name} · {v.moisture_pct}%</div>)}</div>}
    {errors.length>0&&<div className="kaona-card" style={{background:'#fef2f2'}}><p style={{margin:'0 0 8px',fontWeight:600,color:'#991b1b'}}>Preview errors</p>{errors.map((e,i)=><div key={`${e.row}-${i}`} style={{fontSize:13,padding:'4px 0',borderBottom:'1px solid #fecaca'}}>row {e.row} · {e.scale_ticket_no||'-'} · {e.reason} · {e.detail}</div>)}</div>}
    {commitErrors.length>0&&<div className="kaona-card" style={{background:'#fff7ed'}}><p style={{margin:'0 0 8px',fontWeight:600,color:'#9a3412'}}>Commit errors</p>{commitErrors.map((e,i)=><div key={`${e.row}-c-${i}`} style={{fontSize:13,padding:'4px 0',borderBottom:'1px solid #fed7aa'}}>row {e.row} · {e.scale_ticket_no||'-'} · {e.reason} · {e.detail}</div>)}</div>}
  </div>;
}
