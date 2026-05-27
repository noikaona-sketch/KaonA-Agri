'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { PlotMap, PlotData } from '@/shared/components/plot-map';

type Tab = 'all' | 'by-member';
type MemberOption = { id:string; full_name:string; plotCount:number };

export default function AdminFarmingPage() {
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

    // build member list from all plots
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
  const selPlotData = plots.find(p => p.id === selPlot) ?? null;
  const totalRai    = filtered.reduce((s,p) => s+Number(p.area_rai), 0);
  const withGPS     = filtered.filter(p => p.lat && p.lng).length;
  const withBound   = filtered.filter(p => p.boundary_geojson).length;

  return (
    <AdminWebShell title="🗺️ แผนที่แปลงเกษตร" subtitle="ดูตำแหน่งแปลง วาดขอบเขต และจัดการพื้นที่">

      {notice && (
        <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:8, padding:'10px 16px', marginBottom:12, fontSize:13, fontWeight:600, color:'#065F46' }}>
          {notice}
        </div>
      )}

      {/* Tab + controls */}
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

      {/* Main layout: table left + map right */}
      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, alignItems:'start' }}>

        {/* ── Left: plot list ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { label:'แปลงทั้งหมด', value:filtered.length,  color:'#2D6A4F' },
              { label:'ไร่รวม',      value:`${totalRai.toLocaleString('th-TH',{maximumFractionDigits:1})}`, color:'#2563EB' },
              { label:'มี GPS',      value:withGPS,           color:'#059669' },
              { label:'มีขอบเขต',   value:withBound,          color:'#7C3AED' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                <p style={{ margin:0, fontSize:18, fontWeight:800, color:k.color }}>{k.value}</p>
                <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <input placeholder="🔍 ค้นหาแปลง ชื่อ จังหวัด…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />

          {/* Plot list */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden', maxHeight:460, overflowY:'auto' }}>
            {loading && <p style={{ textAlign:'center', padding:20, color:'#9CA3AF', fontSize:13 }}>⏳ กำลังโหลด…</p>}
            {!loading && filtered.length === 0 && (
              <p style={{ textAlign:'center', padding:24, color:'#9CA3AF', fontSize:13 }}>ไม่พบแปลง</p>
            )}
            {filtered.map((p, i) => (
              <div key={p.id}
                onClick={() => setSelPlot(selPlot===p.id ? null : p.id)}
                style={{ padding:'11px 14px', borderBottom:i<filtered.length-1?'1px solid #F3F4F6':'none', cursor:'pointer', background:selPlot===p.id?'#F0FDF4':'#fff', transition:'background .1s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>{p.name}</span>
                      {p.boundary_geojson && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#EDE9FE', color:'#5B21B6', fontWeight:700 }}>มีขอบเขต</span>}
                      {(!p.lat && !p.lng) && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#FEF3C7', color:'#92400E', fontWeight:700 }}>ไม่มี GPS</span>}
                    </div>
                    {p.member && <p style={{ margin:'2px 0 0', fontSize:11, color:'#9CA3AF' }}>👤 {p.member.full_name}</p>}
                    <p style={{ margin:'2px 0 0', fontSize:11, color:'#6B7280' }}>
                      {p.province ?? '—'} {p.district ? `· ${p.district}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#2D6A4F' }}>{p.area_rai}</p>
                    <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>ไร่</p>
                    {p.area_rai_calculated && (
                      <p style={{ margin:'1px 0 0', fontSize:10, color:'#7C3AED' }}>📐{p.area_rai_calculated}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: map ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <PlotMap
            plots={filtered}
            selectedId={selPlot}
            onSelect={setSelPlot}
            editMode={editMode}
            onSaveBoundary={saveBoundary}
            height={560} />

          {/* Selected plot detail */}
          {selPlotData && (
            <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'14px 18px' }}>
              <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:14 }}>📍 {selPlotData.name}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'พื้นที่ (farmer กรอก)', value:`${selPlotData.area_rai} ไร่`, color:'#2D6A4F' },
                  { label:'พื้นที่ (วัดจาก polygon)', value: selPlotData.area_rai_calculated ? `${selPlotData.area_rai_calculated} ไร่` : '—', color:'#7C3AED' },
                  { label:'GPS', value: selPlotData.lat ? `${selPlotData.lat?.toFixed(5)}, ${selPlotData.lng?.toFixed(5)}` : '—', color:'#374151' },
                  { label:'จังหวัด', value:selPlotData.province??'—', color:'#374151' },
                  { label:'อำเภอ', value:selPlotData.district??'—', color:'#374151' },
                  { label:'ตำบล', value:selPlotData.sub_district??'—', color:'#374151' },
                ].map(row => (
                  <div key={row.label} style={{ background:'#F9FAFB', borderRadius:7, padding:'8px 10px' }}>
                    <p style={{ margin:'0 0 2px', fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.04em' }}>{row.label}</p>
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:row.color }}>{row.value}</p>
                  </div>
                ))}
              </div>
              {editMode && (
                <p style={{ margin:'10px 0 0', fontSize:12, color:'#92400E', background:'#FFFBEB', padding:'8px 12px', borderRadius:7 }}>
                  ✏️ กดปุ่ม Polygon ในแผนที่แล้ววาดขอบเขตแปลง "{selPlotData.name}" · กด 💾 บันทึกเมื่อวาดเสร็จ
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminWebShell>
  );
}
