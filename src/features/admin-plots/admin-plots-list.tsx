'use client';

import { useEffect, useState } from 'react';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type PlotRow = {
  id:string; member_id:string; name:string; area_rai:number;
  province:string|null; district:string|null; sub_district:string|null;
  land_doc_type:string|null; status:string; created_at:string;
  lat:number|null; lng:number|null;
  boundary_geojson:object|null; area_rai_calculated:number|null;
  member:{ id:string; full_name:string; phone:string|null }|null;
};

const LAND_DOC_TH: Record<string,string> = {
  title_deed:'โฉนด', ns3k:'นส.3ก', ns3:'นส.3',
  sk1:'สค.1', por_btor_6:'ภบท.6', other:'อื่นๆ',
};

export function AdminPlotsList() {
  const [plots,   setPlots]   = useState<PlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/plots', { credentials:'include' });
      const d   = (await res.json()) as { plots?:PlotRow[]; error?:string };
      if (!res.ok) setError(d.error ?? 'โหลดไม่สำเร็จ');
      else setPlots(d.plots ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState label="กำลังโหลดแปลง…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const filtered = plots.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || (p.member?.full_name??'').toLowerCase().includes(q)
      || (p.province??'').toLowerCase().includes(q)
      || (p.district??'').toLowerCase().includes(q);
  });

  const totalRai = filtered.reduce((s,p) => s + Number(p.area_rai), 0);

  return (
    <div>
      <div style={{ marginBottom:16, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }}>🔍</span>
          <input placeholder="ค้นหาชื่อแปลง ชื่อสมาชิก จังหวัด…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' }} />
        </div>
        <span style={{ fontSize:12, color:'#9CA3AF', whiteSpace:'nowrap' }}>
          {filtered.length} แปลง · {totalRai.toLocaleString('th-TH',{maximumFractionDigits:1})} ไร่รวม
        </span>
      </div>

      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'52px 24px', color:'#9CA3AF' }}>
            <div style={{ fontSize:36, marginBottom:8, opacity:.4 }}>🌾</div>
            <p style={{ fontWeight:600, color:'#374151', marginBottom:4 }}>ไม่พบแปลง</p>
            <p style={{ fontSize:13 }}>ลองค้นหาด้วยคำอื่น</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
              <thead>
                <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                  {['ชื่อแปลง','เจ้าของ','ไร่','จังหวัด/อำเภอ','เอกสาร','GPS','ขอบเขต','สถานะ','วันที่ลงทะเบียน'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i) => (
                  <tr key={p.id}
                    style={{ borderBottom:i<filtered.length-1?'1px solid #F3F4F6':'none' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='#F9FAFB')}
                    onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                    <td style={{ padding:'11px 14px' }}>
                      <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{p.name}</p>
                      {p.area_rai_calculated && <p style={{ margin:'2px 0 0', fontSize:10, color:'#7C3AED' }}>📐 {p.area_rai_calculated} ไร่</p>}
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:12, color:'#374151' }}>{p.member?.full_name ?? '—'}</td>
                    <td style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:'#2D6A4F' }}>
                      {Number(p.area_rai).toLocaleString('th-TH',{maximumFractionDigits:1})}
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:12, color:'#6B7280' }}>
                      {p.province ?? '—'}{p.district ? ` · ${p.district}` : ''}
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:12, color:'#6B7280' }}>
                      {LAND_DOC_TH[p.land_doc_type??''] ?? p.land_doc_type ?? '—'}
                    </td>
                    <td style={{ padding:'11px 14px', textAlign:'center' }}>
                      {p.lat ? <span style={{ color:'#10B981' }}>✓</span> : <span style={{ color:'#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding:'11px 14px', textAlign:'center' }}>
                      {p.boundary_geojson
                        ? <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'#EDE9FE', color:'#5B21B6', fontWeight:700 }}>มี</span>
                        : <span style={{ color:'#D1D5DB', fontSize:11 }}>—</span>}
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, fontWeight:600,
                        background:p.status==='active'?'#D1FAE5':p.status==='pending_review'?'#FEF3C7':'#F3F4F6',
                        color:p.status==='active'?'#065F46':p.status==='pending_review'?'#92400E':'#6B7280' }}>
                        {p.status==='active'?'ใช้งาน':p.status==='pending_review'?'รอตรวจ':p.status}
                      </span>
                    </td>
                    <td style={{ padding:'11px 14px', fontSize:11, color:'#9CA3AF', whiteSpace:'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
