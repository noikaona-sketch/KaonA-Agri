'use client';

import { useCallback, useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/drawer';
import { isCornSeedProduct } from '@/lib/products/corn-seed';

/* ── Types ── */
type BillRow = {
  bill_id:string; bill_no:string; variety_name:string;
  qty:number; bag_weight_kg:number; quota_kg:number;
  days_to_harvest:number|null; product_id:string|null; created_at:string;
};
type CycleRow = { id:string; crop_name:string; planted_at:string|null; status:string; season_year:number|null };
type MemberRow = {
  member_id:string; member_name:string; member_phone:string|null; member_status:string;
  plot_count:number; total_rai:number;
  bill_count:number; bills:BillRow[];
  has_cycle:boolean; cycles:CycleRow[];
};
type Plot = { id:string; name:string; area_rai:number };
type CropConfig = { crop_type:string; yield_per_rai:number; quota_per_seed_kg:number };

const CROP_ICONS: Record<string,string> = {
  'ข้าวโพด':'🌽', 'ข้าว':'🌾', 'มันสำปะหลัง':'🥔',
  'อ้อย':'🎋', 'ถั่วเหลือง':'🫘', 'ข้าวโพดหวาน':'🌽',
};

function isCornCrop(cropName:string) {
  return isCornSeedProduct({ category:'seed', product_type:'seed', crop_type:cropName, name:cropName });
}

/* ── Create Cycle Drawer ── */
function CreateCycleDrawer({ member, bills, onClose, onCreated }: {
  member:MemberRow; bills:BillRow[]; onClose:()=>void; onCreated:()=>void;
}) {
  const [plots,       setPlots]       = useState<Plot[]>([]);
  const [cropConfigs, setCropConfigs] = useState<CropConfig[]>([]);
  const [cropName,    setCropName]    = useState('');
  const [selBillIds,  setSelBillIds]  = useState<Set<string>>(new Set());
  const [plotId,      setPlotId]      = useState('');
  const [plantedDate, setPlantedDate] = useState(new Date().toISOString().slice(0,10));
  const [harvestManual, setHarvestManual] = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string|null>(null);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/member/plots?member_id=${member.member_id}`, { credentials:'include' }).then(r=>r.json()) as Promise<{plots?:Plot[]}>,
      fetch('/api/member/crop-types', { credentials:'include' }).then(r=>r.json()) as Promise<{crops?:CropConfig[]}>,
    ]).then(([plotRes, cropRes]) => {
      setPlots(plotRes.plots ?? []);
      setCropConfigs([...(cropRes.crops ?? []), { crop_type:'อื่นๆ', yield_per_rai:0, quota_per_seed_kg:0 }]);
    });
  }, [member.member_id]);

  const usesBillFlow = isCornCrop(cropName);
  const selBills = usesBillFlow ? bills.filter(b => selBillIds.has(b.bill_id)) : [];
  const totalQuota = usesBillFlow ? selBills.reduce((s,b) => s+b.quota_kg, 0) : null;
  const harvestDays = selBills.map(b=>b.days_to_harvest??999).filter(d=>d<999);
  const minDays = usesBillFlow && harvestDays.length ? Math.min(...harvestDays) : null;
  const harvestDate = minDays && plantedDate
    ? (() => { const d=new Date(plantedDate); d.setDate(d.getDate()+minDays); return d.toISOString().slice(0,10); })()
    : (harvestManual || null);
  const seasonYear = harvestDate ? new Date(harvestDate).getFullYear()+543 : new Date().getFullYear()+543;
  const primaryProductId = usesBillFlow ? (selBills[0]?.product_id ?? null) : null;

  function toggleBill(id:string) {
    setSelBillIds(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  }

  async function save() {
    if (!cropName) { setError('กรุณาเลือกชนิดพืช'); return; }
    if (!plantedDate) { setError('กรุณาระบุวันที่ปลูก'); return; }
    if (usesBillFlow && selBills.length === 0) { setError('กรุณาเลือกบิลเมล็ดข้าวโพดอย่างน้อย 1 บิล'); return; }
    if (!harvestDate) { setError(usesBillFlow ? 'ไม่สามารถคำนวณวันเก็บได้ กรุณาเลือกบิลที่มีข้อมูลอายุพันธุ์ หรือระบุวันที่คาดว่าจะเก็บเกี่ยว' : 'กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/planting-tracker', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        member_id:           member.member_id,
        crop_name:           cropName,
        plot_id:             plotId || null,
        product_id:          primaryProductId,
        planted_at:          plantedDate,
        expected_harvest_at: harvestDate,
        area_planted_rai:    areaRai ? Number(areaRai) : (plotId ? plots.find(p=>p.id===plotId)?.area_rai : null),
        season_year:         seasonYear,
        quota_kg:            usesBillFlow ? totalQuota : null,
      }),
    });
    const d = (await res.json()) as { ok?:boolean; error?:string };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onCreated(); onClose();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626' }}>❌ {error}</div>}

      {/* Member info */}
      <div style={{ background:'#F0FDF4', border:'1px solid #D1FAE5', borderRadius:10, padding:'12px 16px' }}>
        <p style={{ margin:'0 0 4px', fontWeight:700, color:'#065F46', fontSize:14 }}>👤 {member.member_name}</p>
        <p style={{ margin:0, fontSize:12, color:'#6B7280' }}>
          {member.plot_count} แปลง · {member.total_rai.toFixed(1)} ไร่ · {member.bill_count} บิล
        </p>
      </div>

      {/* เลือกชนิดพืช */}
      <div>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>ชนิดพืช *</label>
        <select value={cropName} onChange={e=>{ setCropName(e.target.value); setSelBillIds(new Set()); setHarvestManual(''); }}
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }}>
          <option value="">— เลือกชนิดพืช —</option>
          {cropConfigs.map(c => <option key={c.crop_type} value={c.crop_type}>{CROP_ICONS[c.crop_type] ?? '🌿'} {c.crop_type}</option>)}
        </select>
      </div>

      {/* เลือกบิล (เฉพาะข้าวโพด) */}
      {usesBillFlow && <div>
        <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'#374151' }}>เลือกบิล (หลายบิลได้)</p>
        <div style={{ border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
          {bills.map((b,i) => (
            <div key={b.bill_id} onClick={() => toggleBill(b.bill_id)}
              style={{ display:'flex', gap:10, padding:'10px 12px', cursor:'pointer', borderBottom:i<bills.length-1?'1px solid #F3F4F6':'none', background:selBillIds.has(b.bill_id)?'#F0FDF4':'#fff' }}>
              <input type="checkbox" readOnly checked={selBillIds.has(b.bill_id)} style={{ width:15, height:15, accentColor:'#2D6A4F', flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:600 }}>{b.variety_name}</p>
                <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{b.bill_no} · {b.qty} ถุง × {b.bag_weight_kg} กก.</p>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#7C3AED' }}>{b.quota_kg.toLocaleString('th-TH')} กก.</p>
                {b.days_to_harvest && <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{b.days_to_harvest} วัน</p>}
              </div>
            </div>
          ))}
        </div>
        {selBills.length > 0 && (
          <div style={{ marginTop:6, padding:'8px 10px', background:'#EDE9FE', borderRadius:6, fontSize:12, color:'#5B21B6', fontWeight:600 }}>
            📦 โควต้ารวม: {(totalQuota ?? 0).toLocaleString('th-TH')} กก.
            {minDays && minDays < 999 ? ` · อายุน้อยสุด ${minDays} วัน` : ''}
          </div>
        )}
      </div>}

      {!usesBillFlow && cropName && (
        <div style={{ padding:'10px 12px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, color:'#475569' }}>
          {cropName === 'ข้าว' ? '🌾 รอบปลูกข้าวยังไม่ใช้บิล/โควต้า ให้กรอกวันที่คาดว่าจะเก็บเกี่ยวเอง' : 'ℹ️ พืชชนิดนี้สร้างแบบ manual โดยไม่ผูกบิล/โควต้า'}
        </div>
      )}

      {/* เลือกแปลง */}
      <div>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>เลือกแปลง</label>
        <select value={plotId} onChange={e=>setPlotId(e.target.value)}
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }}>
          <option value="">— ไม่ระบุแปลง —</option>
          {plots.map(p => <option key={p.id} value={p.id}>{p.name} · {p.area_rai} ไร่</option>)}
        </select>
        {plots.length===0 && <p style={{ fontSize:11, color:'#F59E0B', marginTop:4 }}>⚠️ สมาชิกยังไม่มีแปลง</p>}
      </div>

      {/* วันปลูก + ไร่ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>วันที่ปลูก *</label>
          <input type="date" value={plantedDate} onChange={e=>setPlantedDate(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>พื้นที่ (ไร่)</label>
          <input type="number" step="0.5" value={areaRai} onChange={e=>setAreaRai(e.target.value)}
            placeholder={plots.find(p=>p.id===plotId)?.area_rai?.toString() ?? '0.0'}
            style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
      </div>

      {/* วันที่เก็บเกี่ยวเองสำหรับ flow manual หรือกรณีบิลไม่มีอายุพันธุ์ */}
      {(!usesBillFlow || (usesBillFlow && !minDays)) && (
        <div>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>วันที่คาดว่าจะเก็บเกี่ยว *</label>
          <input type="date" value={harvestManual} onChange={e=>setHarvestManual(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
      )}

      {/* สรุป */}
      {harvestDate && (
        <div style={{ background:'#F0FDF4', borderRadius:8, padding:'10px 14px' }}>
          <p style={{ margin:'0 0 2px', fontWeight:700, color:'#065F46', fontSize:13 }}>
            🌾 คาดเก็บ: {new Date(harvestDate).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}
          </p>
          <p style={{ margin:0, fontSize:12, color:'#6B7280' }}>ฤดูกาล พ.ศ. {seasonYear}{usesBillFlow && totalQuota ? ` · โควต้า ${(totalQuota ?? 0).toLocaleString('th-TH')} กก.` : ' · manual'}</p>
        </div>
      )}

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'10px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
          ยกเลิก
        </button>
        <button onClick={save} disabled={saving || !cropName || (usesBillFlow && selBills.length===0)}
          style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:cropName && (!usesBillFlow || selBills.length>0)?'#2D6A4F':'#E5E7EB', color:cropName && (!usesBillFlow || selBills.length>0)?'#fff':'#9CA3AF', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {saving?'⏳ กำลังบันทึก…':'🌱 สร้างรอบปลูก'}
        </button>
      </div>
    </div>
  );
}

/* ── Main ── */
export function AdminPlantingTracker() {
  const [items,      setItems]      = useState<MemberRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string|null>(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<'all'|'no_cycle'|'has_cycle'>('all');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [drawerMember, setDrawerMember] = useState<MemberRow|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/planting-tracker', { credentials:'include' });
    if (res.status === 401) { setError('session_expired'); setLoading(false); return; }
    const d = (await res.json()) as { items?:MemberRow[]; error?:string };
    if (d.error) { setError(d.error); setLoading(false); return; }
    setItems(d.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter(m => {
    if (filter==='no_cycle'  && m.has_cycle)  return false;
    if (filter==='has_cycle' && !m.has_cycle) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.member_name.toLowerCase().includes(q) || (m.member_phone??'').includes(q);
    }
    return true;
  });

  const noCycleCount = items.filter(x=>!x.has_cycle).length;
  const totalQuota   = items.reduce((s,m)=>s+m.bills.reduce((ss,b)=>ss+b.quota_kg,0),0);

  function toggleExpand(id:string) {
    setExpanded(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  }

  if (error === 'session_expired') return (
    <div style={{ textAlign:'center', padding:40 }}>
      <p style={{ color:'#DC2626', fontWeight:600 }}>⏰ Session หมดอายุ</p>
      <a href="/admin-login" style={{ color:'#2D6A4F', fontWeight:700 }}>→ เข้าสู่ระบบใหม่</a>
    </div>
  );

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'ซื้อเมล็ดแล้ว', value:items.length+' คน', color:'#374151' },
          { label:'⚠️ ยังไม่สร้างรอบ', value:noCycleCount+' คน', color:noCycleCount>0?'#DC2626':'#9CA3AF' },
          { label:'✅ สร้างรอบแล้ว', value:(items.length-noCycleCount)+' คน', color:'#059669' },
          { label:'📦 โควต้ารวม', value:(totalQuota/1000).toFixed(1)+' ตัน', color:'#7C3AED' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'12px 16px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
            <p style={{ margin:0, fontSize:20, fontWeight:800, color:k.color }}>{k.value}</p>
            <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}>🔍</span>
          <input placeholder="ค้นหาชื่อ เบอร์…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
        <div style={{ display:'flex', gap:3, background:'#F3F4F6', padding:3, borderRadius:8 }}>
          {([['all','ทั้งหมด'],['no_cycle','⚠️ ยังไม่สร้าง'],['has_cycle','✅ สร้างแล้ว']] as const).map(([k,l]) => (
            <button key={k} onClick={()=>setFilter(k)}
              style={{ padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:filter===k?700:400, background:filter===k?'#fff':'transparent', color:filter===k?'#111':'#6B7280', boxShadow:filter===k?'0 1px 3px rgba(0,0,0,.08)':'none' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>🔄</button>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>{filtered.length} รายการ</span>
      </div>

      {loading && <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 24px', color:'#9CA3AF' }}>
          <div style={{ fontSize:36, marginBottom:8, opacity:.4 }}>🌱</div>
          <p style={{ fontWeight:600, color:'#374151' }}>ไม่พบข้อมูล</p>
          <p style={{ fontSize:13 }}>ยังไม่มีสมาชิกที่รับสินค้าเมล็ดพันธุ์แล้ว</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
            <thead>
              <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                <th style={{ width:36 }}/>
                {['สมาชิก','แปลง / ไร่','บิล','โควต้ารวม','รอบปลูก',''].map((h,i) => (
                  <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const isExp = expanded.has(m.member_id);
                const memberQuota = m.bills.reduce((s,b)=>s+b.quota_kg,0);
                return (
                  <>
                    <tr key={m.member_id}
                      style={{ borderBottom:'1px solid #E5E7EB', background:m.has_cycle?'#fff':'#FFFBEB' }}>
                      <td style={{ padding:'0 0 0 12px', textAlign:'center' }}>
                        <button onClick={()=>toggleExpand(m.member_id)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#9CA3AF', padding:4, transition:'transform .15s', transform:isExp?'rotate(90deg)':'none' }}>
                          ▶
                        </button>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:13 }}>{m.member_name}</p>
                        <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{m.member_phone??'—'}</p>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:13 }}>
                        <span style={{ fontWeight:700 }}>{m.plot_count}</span>
                        <span style={{ color:'#9CA3AF', fontSize:11 }}> แปลง</span>
                        <span style={{ fontWeight:700, marginLeft:8 }}>{m.total_rai.toFixed(1)}</span>
                        <span style={{ color:'#9CA3AF', fontSize:11 }}> ไร่</span>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:700 }}>{m.bill_count} บิล</td>
                      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:700, color:'#7C3AED' }}>
                        {(memberQuota/1000).toFixed(1)} ตัน
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {m.has_cycle
                          ? <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'#D1FAE5', color:'#065F46', fontWeight:600 }}>
                              ✅ {m.cycles[0]?.planted_at ? new Date(m.cycles[0].planted_at).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : 'มีแล้ว'}
                            </span>
                          : <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'#FEF3C7', color:'#92400E', fontWeight:600 }}>⚠️ ยังไม่สร้าง</span>
                        }
                      </td>
                      <td style={{ padding:'12px 14px', textAlign:'right' }}>
                        {!m.has_cycle && (
                          <button onClick={()=>setDrawerMember(m)}
                            style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#2D6A4F', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            🌱 สร้างแทน
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Expanded: บิล + รอบปลูก */}
                    {isExp && (
                      <tr key={`${m.member_id}-exp`}>
                        <td/>
                        <td colSpan={6} style={{ padding:'0 14px 12px 14px', background:'#F9FAFB' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, paddingTop:8 }}>
                            {/* บิล */}
                            <div>
                              <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase' }}>📄 บิลซื้อเมล็ด</p>
                              {m.bills.map(b => (
                                <div key={b.bill_id} style={{ padding:'7px 10px', background:'#fff', borderRadius:7, border:'1px solid #E5E7EB', marginBottom:5 }}>
                                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                                    <div>
                                      <p style={{ margin:0, fontSize:12, fontWeight:600 }}>{b.variety_name}</p>
                                      <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{b.bill_no} · {b.qty} ถุง × {b.bag_weight_kg} กก.</p>
                                    </div>
                                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#7C3AED' }}>
                                      {b.quota_kg.toLocaleString('th-TH')} กก.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* รอบปลูก */}
                            <div>
                              <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase' }}>🌱 รอบปลูก</p>
                              {m.cycles.length === 0
                                ? <p style={{ fontSize:12, color:'#F59E0B', padding:'8px 10px', background:'#FFFBEB', borderRadius:7, border:'1px solid #FCD34D' }}>⚠️ ยังไม่มีรอบปลูก</p>
                                : m.cycles.map(c => (
                                  <div key={c.id} style={{ padding:'7px 10px', background:'#fff', borderRadius:7, border:'1px solid #E5E7EB', marginBottom:5 }}>
                                    <p style={{ margin:0, fontSize:12, fontWeight:600 }}>{c.crop_name}</p>
                                    <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>
                                      ปลูก {c.planted_at ? new Date(c.planted_at).toLocaleDateString('th-TH') : '—'}
                                      {c.season_year ? ` · ฤดูกาล ${c.season_year}` : ''}
                                    </p>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer สร้างแทน */}
      <Drawer open={!!drawerMember} onClose={()=>setDrawerMember(null)}
        title={`🌱 สร้างรอบปลูกแทน ${drawerMember?.member_name??''}`} width={480}>
        {drawerMember && (
          <CreateCycleDrawer
            member={drawerMember}
            bills={drawerMember.bills}
            onClose={()=>setDrawerMember(null)}
            onCreated={()=>{ void load(); }}
          />
        )}
      </Drawer>
    </div>
  );
}
