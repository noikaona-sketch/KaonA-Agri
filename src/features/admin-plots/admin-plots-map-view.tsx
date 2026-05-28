'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlotMap, PlotData } from '@/shared/components/plot-map';

/* ── Accordion: อำเภอ → ตำบล → รายแปลง ── */
function PlotAccordion({ plots, selectedId, onSelect }: {
  plots: PlotData[]; selectedId:string|null; onSelect:(id:string)=>void;
}) {
  const [openDistrict,    setOpenDistrict]    = useState<Set<string>>(new Set());
  const [openSubdistrict, setOpenSubdistrict] = useState<Set<string>>(new Set());

  // จัดกลุ่มตามอำเภอ → ตำบล
  const byDistrict = plots.reduce((acc, p) => {
    const d = p.district ?? 'ไม่ระบุอำเภอ';
    const s = p.sub_district ?? 'ไม่ระบุตำบล';
    if (!acc[d]) acc[d] = {};
    if (!acc[d][s]) acc[d][s] = [];
    acc[d][s].push(p);
    return acc;
  }, {} as Record<string, Record<string, PlotData[]>>);

  function toggleD(d:string) {
    setOpenDistrict(p => { const n=new Set(p); n.has(d)?n.delete(d):n.add(d); return n; });
  }
  function toggleS(key:string) {
    setOpenSubdistrict(p => { const n=new Set(p); n.has(key)?n.delete(key):n.add(key); return n; });
  }

  return (
    <div>
      {Object.entries(byDistrict).map(([district, subdists]) => {
        const dPlots   = Object.values(subdists).flat();
        const dRai     = dPlots.reduce((s,p) => s+Number(p.area_rai), 0);
        const isOpenD  = openDistrict.has(district);
        return (
          <div key={district}>
            {/* อำเภอ row */}
            <div onClick={() => toggleD(district)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', cursor:'pointer', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', userSelect:'none' }}>
              <span style={{ fontSize:11, color:'#9CA3AF', transition:'transform .15s', display:'inline-block', transform:isOpenD?'rotate(90deg)':'rotate(0)' }}>▶</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#111', flex:1 }}>อ. {district}</span>
              <span style={{ fontSize:11, color:'#6B7280' }}>{dPlots.length} แปลง</span>
              <span style={{ fontSize:11, color:'#2D6A4F', fontWeight:600, marginLeft:6 }}>{dRai.toFixed(1)} ไร่</span>
            </div>

            {isOpenD && Object.entries(subdists).map(([sub, sPlots]) => {
              const skey    = `${district}__${sub}`;
              const sRai    = sPlots.reduce((s,p) => s+Number(p.area_rai), 0);
              const isOpenS = openSubdistrict.has(skey);
              return (
                <div key={skey}>
                  {/* ตำบล row */}
                  <div onClick={() => toggleS(skey)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px 8px 28px', cursor:'pointer', background:'#FAFAFA', borderBottom:'1px solid #F3F4F6', userSelect:'none' }}>
                    <span style={{ fontSize:10, color:'#9CA3AF', transition:'transform .15s', display:'inline-block', transform:isOpenS?'rotate(90deg)':'rotate(0)' }}>▶</span>
                    <span style={{ fontSize:12, fontWeight:600, color:'#374151', flex:1 }}>ต. {sub}</span>
                    <span style={{ fontSize:11, color:'#6B7280' }}>{sPlots.length} แปลง · {sRai.toFixed(1)} ไร่</span>
                  </div>

                  {/* รายแปลง */}
                  {isOpenS && sPlots.map((p,i) => (
                    <div key={p.id} onClick={() => onSelect(p.id)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px 9px 44px', borderBottom:i<sPlots.length-1?'1px solid #F9FAFB':'1px solid #F3F4F6', cursor:'pointer', background:selectedId===p.id?'#F0FDF4':'#fff', transition:'background .1s' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:selectedId===p.id?'#10B981':'#D1D5DB', flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                        {p.member && <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>👤 {p.member.full_name}</p>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#2D6A4F' }}>{p.area_rai}</p>
                        <p style={{ margin:0, fontSize:9, color:'#9CA3AF' }}>ไร่</p>
                      </div>
                      {p.boundary_geojson && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#EDE9FE', color:'#5B21B6', fontWeight:700 }}>⬡</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

type Tab = 'all' | 'by-member';
type MemberOption = { id:string; full_name:string; plotCount:number };

export function AdminPlotsMapView() {
  const [tab,       setTab]       = useState<Tab>('all');
  const [plots,     setPlots]     = useState<PlotData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selPlot,   setSelPlot]   = useState<string|null>(null);
  const [selMember, setSelMember] = useState<string>('');
  const [members,   setMembers]   = useState<MemberOption[]>([]);
  const [editMode,  setEditMode]  = useState(false);
  const [search,    setSearch]    = useState('');
  const [notice,    setNotice]    = useState<string|null>(null);

  const loadPlots = useCallback(async (memberId='') => {
    setLoading(true);
    const url = memberId ? `/api/admin/plots?member_id=${memberId}` : '/api/admin/plots';
    const res = await fetch(url, { credentials:'include' });
    const d   = (await res.json()) as { plots?: PlotData[] };
    const ps  = d.plots ?? [];
    setPlots(ps);
    setLoading(false);

    if (!memberId) {
      const map = new Map<string, MemberOption>();
      ps.forEach(p => {
        if (p.member && !map.has(p.member.id)) {
          map.set(p.member.id, { id:p.member.id, full_name:p.member.full_name, plotCount:0 });
        }
        if (p.member) map.get(p.member.id)!.plotCount++;
      });
      setMembers([...map.values()]);
    }
  }, []);

  useEffect(() => { void loadPlots(); }, [loadPlots]);

  useEffect(() => {
    if (tab === 'by-member' && selMember) void loadPlots(selMember);
    else if (tab === 'all') void loadPlots();
  }, [tab, selMember, loadPlots]);

  async function saveBoundary(plotId:string, geojson:object, areaRai:number) {
    const res = await fetch('/api/admin/plots', {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ plot_id:plotId, boundary_geojson:geojson, area_rai_calculated:areaRai }),
    });
    if (res.ok) {
      setNotice(`✅ บันทึก polygon แล้ว (${areaRai} ไร่)`);
      setTimeout(() => setNotice(null), 4000);
      void loadPlots(tab==='by-member'?selMember:'');
    }
  }

  const filtered = plots.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || (p.province??'').toLowerCase().includes(q)
      || (p.district??'').toLowerCase().includes(q)
      || (p.member?.full_name??'').toLowerCase().includes(q);
  });

  const totalRai   = filtered.reduce((s,p) => s+Number(p.area_rai), 0);
  const withGPS    = filtered.filter(p => p.lat && p.lng).length;
  const withBound  = filtered.filter(p => p.boundary_geojson).length;
  const selPlotData = plots.find(p => p.id === selPlot) ?? null;

  return (
    <div>
      {notice && (
        <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:8, padding:'10px 16px', marginBottom:12, fontSize:13, fontWeight:600, color:'#065F46' }}>
          {notice}
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:2, background:'#F3F4F6', padding:3, borderRadius:8 }}>
          {([['all','🗺️ รวมทุกแปลง'],['by-member','👤 แยกตามสมาชิก']] as const).map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setSelPlot(null); setEditMode(false); }}
              style={{ padding:'7px 16px', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===k?700:400, background:tab===k?'#fff':'transparent', color:tab===k?'#111':'#6B7280', boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'by-member' && (
          <select value={selMember} onChange={e => { setSelMember(e.target.value); setSelPlot(null); }}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, background:'#fff', minWidth:200 }}>
            <option value="">— เลือกสมาชิก —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.plotCount} แปลง)</option>)}
          </select>
        )}

        <button onClick={() => setEditMode(p=>!p)}
          style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${editMode?'#F4A261':'#E5E7EB'}`, background:editMode?'#FFFBEB':'#fff', color:editMode?'#92400E':'#374151', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          {editMode ? '✏️ โหมดวาด (เปิด)' : '✏️ วาดขอบเขต'}
        </button>
      </div>

      {/* Main: table left + map right */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>
        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { label:'แปลงทั้งหมด', value:filtered.length,   color:'#2D6A4F' },
              { label:'ไร่รวม',       value:`${totalRai.toLocaleString('th-TH',{maximumFractionDigits:1})}`, color:'#2563EB' },
              { label:'มี GPS',       value:withGPS,            color:'#059669' },
              { label:'มีขอบเขต',    value:withBound,           color:'#7C3AED' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                <p style={{ margin:0, fontSize:18, fontWeight:800, color:k.color }}>{k.value}</p>
                <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{k.label}</p>
              </div>
            ))}
          </div>

          <input placeholder="🔍 ค้นหาแปลง ชื่อ จังหวัด…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />

          {/* Accordion by district → subdistrict → plots */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden', maxHeight:420, overflowY:'auto' }}>
            {loading && <p style={{ textAlign:'center', padding:20, color:'#9CA3AF', fontSize:13 }}>⏳ กำลังโหลด…</p>}
            {!loading && filtered.length === 0 && <p style={{ textAlign:'center', padding:24, color:'#9CA3AF', fontSize:13 }}>ไม่พบแปลง</p>}
            {!loading && filtered.length > 0 && (
              <PlotAccordion plots={filtered} selectedId={selPlot} onSelect={setSelPlot} />
            )}
          </div>
        </div>

        {/* Right: map */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <PlotMap plots={filtered} selectedId={selPlot} onSelect={setSelPlot}
            editMode={editMode} onSaveBoundary={saveBoundary} height={520} />
          {selPlotData && (
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'14px 18px' }}>
              <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:14 }}>📍 {selPlotData.name}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'พื้นที่ (farmer)', value:`${selPlotData.area_rai} ไร่`, color:'#2D6A4F' },
                  { label:'พื้นที่ (polygon)', value:selPlotData.area_rai_calculated?`${selPlotData.area_rai_calculated} ไร่`:'—', color:'#7C3AED' },
                  { label:'GPS', value:selPlotData.lat?`${selPlotData.lat.toFixed(4)}, ${selPlotData.lng?.toFixed(4)}`:'—', color:'#374151' },
                  { label:'จังหวัด', value:selPlotData.province??'—', color:'#374151' },
                  { label:'อำเภอ', value:selPlotData.district??'—', color:'#374151' },
                  { label:'ตำบล', value:selPlotData.sub_district??'—', color:'#374151' },
                ].map(r => (
                  <div key={r.label} style={{ background:'#F9FAFB', borderRadius:7, padding:'8px 10px' }}>
                    <p style={{ margin:'0 0 2px', fontSize:10, color:'#9CA3AF', textTransform:'uppercase' }}>{r.label}</p>
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:r.color }}>{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
