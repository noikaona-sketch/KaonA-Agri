'use client';

import { useCallback, useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/drawer';

/* ── Types ── */
type TrackerItem = {
  seed_id:string; reservation_no:string; member_id:string;
  member_name:string; member_phone:string|null; member_status:string;
  variety_name:string; qty_reserved:number; bag_weight_kg:number;
  days_to_harvest:number|null; quota_kg:number; product_id:string|null;
  created_at:string; has_cycle:boolean; cycle_id:string|null;
  cycle_status:string|null; cycle_planted:string|null;
};
type Plot = { id:string; name:string; area_rai:number };

/* ── Create Cycle Drawer ── */
function CreateCycleDrawer({ item, onClose, onCreated }: {
  item: TrackerItem; onClose:()=>void; onCreated:()=>void;
}) {
  const [plots,       setPlots]       = useState<Plot[]>([]);
  const [plotId,      setPlotId]      = useState('');
  const [plantedDate, setPlantedDate] = useState(new Date().toISOString().slice(0,10));
  const [areaRai,     setAreaRai]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string|null>(null);

  useEffect(() => {
    void fetch(`/api/member/plots?member_id=${item.member_id}`, { credentials:'include' })
      .then(r => r.json()).then((d: {plots?:Plot[]}) => setPlots(d.plots ?? []));
  }, [item.member_id]);

  // คำนวณวันเก็บ
  const harvestDate = item.days_to_harvest && plantedDate
    ? (() => { const d=new Date(plantedDate); d.setDate(d.getDate()+item.days_to_harvest!); return d.toISOString().slice(0,10); })()
    : null;
  const seasonYear = harvestDate ? (new Date(harvestDate).getFullYear()+543) : (new Date().getFullYear()+543);

  async function save() {
    if (!plantedDate) { setError('กรุณาระบุวันที่ปลูก'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/planting-tracker', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        member_id:           item.member_id,
        crop_name:           'ข้าวโพด',
        plot_id:             plotId || null,
        product_id:          item.product_id,
        planted_at:          plantedDate,
        expected_harvest_at: harvestDate,
        area_planted_rai:    areaRai ? Number(areaRai) : null,
        season_year:         seasonYear,
        quota_kg:            item.quota_kg,
      }),
    });
    const d = (await res.json()) as { ok?:boolean; error?:string };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onCreated();
    onClose();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626' }}>❌ {error}</div>}

      {/* Info */}
      <div style={{ background:'#F0FDF4', border:'1px solid #D1FAE5', borderRadius:10, padding:'12px 16px' }}>
        <p style={{ margin:'0 0 4px', fontWeight:700, color:'#065F46' }}>👤 {item.member_name}</p>
        <p style={{ margin:'0 0 2px', fontSize:12, color:'#6B7280' }}>🌽 {item.variety_name} · {item.qty_reserved} ถุง</p>
        <p style={{ margin:0, fontSize:12, color:'#7C3AED', fontWeight:600 }}>📦 โควต้า {item.quota_kg.toLocaleString('th-TH')} กก.</p>
      </div>

      {/* เลือกแปลง */}
      <div>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>
          เลือกแปลง (ถ้ามี)
        </label>
        <select value={plotId} onChange={e=>setPlotId(e.target.value)}
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }}>
          <option value="">— ไม่ระบุแปลง —</option>
          {plots.map(p => <option key={p.id} value={p.id}>{p.name} · {p.area_rai} ไร่</option>)}
        </select>
        {plots.length===0 && <p style={{ fontSize:11, color:'#F59E0B', marginTop:4 }}>⚠️ สมาชิกยังไม่มีแปลงที่ลงทะเบียน</p>}
      </div>

      {/* วันที่ปลูก + พื้นที่ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>วันที่ปลูก *</label>
          <input type="date" value={plantedDate} onChange={e=>setPlantedDate(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>พื้นที่ (ไร่)</label>
          <input type="number" step="0.5" value={areaRai} onChange={e=>setAreaRai(e.target.value)}
            placeholder={plotId ? String(plots.find(p=>p.id===plotId)?.area_rai??'') : '0.0'}
            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
      </div>

      {/* สรุป */}
      {harvestDate && (
        <div style={{ background:'#F0FDF4', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
          <p style={{ margin:'0 0 2px', fontWeight:700, color:'#065F46' }}>
            🌾 คาดเก็บ: {new Date(harvestDate).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}
          </p>
          <p style={{ margin:0, fontSize:12, color:'#6B7280' }}>
            ฤดูกาล พ.ศ. {seasonYear} · โควต้า {item.quota_kg.toLocaleString('th-TH')} กก.
          </p>
        </div>
      )}

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'10px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
          ยกเลิก
        </button>
        <button onClick={save} disabled={saving}
          style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'#2D6A4F', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.7:1 }}>
          {saving ? '⏳ กำลังบันทึก…' : '🌱 สร้างรอบปลูก'}
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function AdminPlantingTracker() {
  const [items,   setItems]   = useState<TrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all'|'no_cycle'|'has_cycle'>('all');
  const [drawerItem, setDrawerItem] = useState<TrackerItem|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/planting-tracker', { credentials:'include' });
    const d   = (await res.json()) as { items?:TrackerItem[] };
    setItems(d.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter(it => {
    if (filter==='no_cycle'  && it.has_cycle)  return false;
    if (filter==='has_cycle' && !it.has_cycle) return false;
    if (search) {
      const q = search.toLowerCase();
      return it.member_name.toLowerCase().includes(q)
        || it.variety_name.toLowerCase().includes(q)
        || (it.member_phone??'').includes(q);
    }
    return true;
  });

  const noCycleCount = items.filter(x => !x.has_cycle).length;

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'ซื้อเมล็ดทั้งหมด', value:items.length, color:'#374151' },
          { label:'⚠️ ยังไม่สร้างรอบปลูก', value:noCycleCount, color:noCycleCount>0?'#DC2626':'#9CA3AF' },
          { label:'✅ สร้างรอบปลูกแล้ว', value:items.length-noCycleCount, color:'#059669' },
        ].map(k => (
          <div key={k.label} style={{ flex:1, minWidth:120, background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:22, fontWeight:800, color:k.color }}>{k.value}</p>
            <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}>🔍</span>
          <input placeholder="ค้นหาชื่อ เบอร์…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' as const }} />
        </div>
        <div style={{ display:'flex', gap:4, background:'#F3F4F6', padding:3, borderRadius:8 }}>
          {([['all','ทั้งหมด'],['no_cycle','⚠️ ยังไม่สร้าง'],['has_cycle','✅ สร้างแล้ว']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12,
                fontWeight:filter===k?700:400, background:filter===k?'#fff':'transparent',
                color:filter===k?'#111':'#6B7280', boxShadow:filter===k?'0 1px 3px rgba(0,0,0,.08)':'none' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>🔄</button>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>แสดง {filtered.length} รายการ</span>
      </div>

      {/* Table */}
      {loading && <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</p>}
      {!loading && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 24px', color:'#9CA3AF' }}>
              <div style={{ fontSize:36, marginBottom:8, opacity:.4 }}>🌱</div>
              <p style={{ fontWeight:600, color:'#374151' }}>ไม่พบข้อมูล</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead>
                  <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                    {['สมาชิก','พันธุ์','บิล','ถุง','โควต้า','รอบปลูก',''].map((h,i) => (
                      <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={item.seed_id}
                      style={{ borderBottom:idx<filtered.length-1?'1px solid #F3F4F6':'none', background:item.has_cycle?'#fff':'#FFFBEB' }}>
                      <td style={{ padding:'12px 14px' }}>
                        <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{item.member_name}</p>
                        <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{item.member_phone??'—'}</p>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:12, color:'#374151' }}>{item.variety_name}</td>
                      <td style={{ padding:'12px 14px', fontSize:11, color:'#9CA3AF', fontFamily:'monospace' }}>{item.reservation_no}</td>
                      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600 }}>{item.qty_reserved}</td>
                      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:700, color:'#7C3AED' }}>
                        {item.quota_kg.toLocaleString('th-TH')} กก.
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {item.has_cycle ? (
                          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'#D1FAE5', color:'#065F46', fontWeight:600 }}>
                            ✅ {item.cycle_planted ? new Date(item.cycle_planted).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : 'มีแล้ว'}
                          </span>
                        ) : (
                          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'#FEF3C7', color:'#92400E', fontWeight:600 }}>
                            ⚠️ ยังไม่สร้าง
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'12px 14px', textAlign:'right' }}>
                        {!item.has_cycle && (
                          <button onClick={() => setDrawerItem(item)}
                            style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#2D6A4F', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            🌱 สร้างแทน
                          </button>
                        )}
                        {item.has_cycle && item.cycle_id && (
                          <a href={`/admin/planting-cycles/${item.cycle_id}`}
                            style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #E5E7EB', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
                            ดู →
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer สร้างแทน */}
      <Drawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        title={`🌱 สร้างรอบปลูกแทน ${drawerItem?.member_name ?? ''}`}
        width={480}>
        {drawerItem && (
          <CreateCycleDrawer
            item={drawerItem}
            onClose={() => setDrawerItem(null)}
            onCreated={() => { void load(); }}
          />
        )}
      </Drawer>
    </div>
  );
}
