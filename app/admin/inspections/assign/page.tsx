'use client';

import { useEffect, useState } from 'react';
import { AdminWebShell }       from '@/shared/components/admin-web-shell';

type Inspection = {
  id: string; result_status: string; assigned_at: string | null;
  plots: { name: string | null; province: string | null } | null;
  inspector: { full_name: string; phone: string | null } | null;
  no_burn_request_id: string | null;
};
type Inspector = {
  member_id: string;
  members: { id: string; full_name: string; phone: string | null } | null;
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color:'#d97706', bg:'#fffbeb', label:'⏳ รอมอบหมาย' },
  assigned: { color:'#1d4ed8', bg:'#eff6ff', label:'📋 มอบหมายแล้ว' },
  passed:   { color:'#059669', bg:'#f0fdf4', label:'✅ ผ่าน' },
  failed:   { color:'#dc2626', bg:'#fef2f2', label:'❌ ไม่ผ่าน' },
  completed:{ color:'#6b7280', bg:'#f9fafb', label:'✓ เสร็จสิ้น' },
};

export default function AdminAssignInspectionPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors,  setInspectors]  = useState<Inspector[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [assigning,   setAssigning]   = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Record<string, string>>({});
  const [notice,      setNotice]      = useState<string | null>(null);
  const [filter,      setFilter]      = useState<'pending' | 'all'>('pending');

  async function load() {
    setLoading(true);
    const q   = filter === 'pending' ? '?status=pending' : '';
    const res = await fetch(`/api/admin/inspections${q}`);
    const d   = (await res.json()) as { inspections?: Inspection[]; inspectors?: Inspector[] };
    setInspections(d.inspections ?? []);
    setInspectors(d.inspectors  ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [filter]);

  async function assign(inspectionId: string) {
    const inspectorId = selected[inspectionId];
    if (!inspectorId) { setNotice('❌ กรุณาเลือก inspector ก่อน'); return; }
    setAssigning(inspectionId);
    const res = await fetch('/api/admin/inspections/assign', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ inspection_id:inspectionId, inspector_member_id:inspectorId }),
    });
    setAssigning(null);
    const d = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ มอบหมายแล้ว — LINE แจ้ง inspector แล้ว');
    await load();
  }

  return (
    <AdminWebShell title="🔍 มอบหมายงานตรวจแปลง" subtitle="เลือก inspector และส่งงาน">
      {notice && (
        <div style={{ background:notice.startsWith('✅')?'#ecfdf5':'#fef2f2', border:`1px solid ${notice.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color:notice.startsWith('✅')?'#14532d':'#991b1b', display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <span>{notice}</span>
          <button onClick={()=>setNotice(null)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {(['pending','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`admin-btn ${filter===f?'admin-btn--primary':'admin-btn--secondary'}`}
            style={{ fontSize:13, padding:'7px 14px' }}>
            {f === 'pending' ? '⏳ รอมอบหมาย' : '📋 ทั้งหมด'}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color:'#9ca3af', textAlign:'center', padding:24 }}>กำลังโหลด…</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>แปลง</th><th>สถานะ</th><th>Inspector ปัจจุบัน</th><th>มอบหมายให้</th><th></th></tr>
            </thead>
            <tbody>
              {inspections.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:'center',color:'#9ca3af',padding:24}}>ไม่มีงานรอมอบหมาย</td></tr>
              )}
              {inspections.map(ins => {
                const cfg  = STATUS_CFG[ins.result_status] ?? STATUS_CFG.pending;
                const plot = ins.plots as { name: string | null; province: string | null } | null;
                return (
                  <tr key={ins.id}>
                    <td>
                      <p style={{margin:'0 0 2px',fontWeight:600,fontSize:13}}>{plot?.name ?? `แปลง ${ins.id.slice(0,8)}`}</p>
                      {plot?.province && <p style={{margin:0,fontSize:11,color:'#9ca3af'}}>{plot.province}</p>}
                      {ins.no_burn_request_id && <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:'#FED7D7',color:'#742A2A'}}>ไม่เผา</span>}
                    </td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:cfg.bg,color:cfg.color,fontWeight:500}}>{cfg.label}</span></td>
                    <td style={{fontSize:12,color:'#6b7280'}}>
                      {(ins.inspector as { full_name: string } | null)?.full_name ?? '—'}
                    </td>
                    <td>
                      {ins.result_status === 'pending' || ins.result_status === 'assigned' ? (
                        <select className="reg-input" value={selected[ins.id] ?? ''}
                          onChange={e => setSelected(p => ({...p, [ins.id]:e.target.value}))}
                          style={{fontSize:12,minWidth:140}}>
                          <option value="">— เลือก inspector —</option>
                          {inspectors.map(i => {
                            const m = i.members as { id: string; full_name: string } | null;
                            return m ? <option key={m.id} value={m.id}>{m.full_name}</option> : null;
                          })}
                        </select>
                      ) : <span style={{color:'#9ca3af',fontSize:12}}>เสร็จสิ้น</span>}
                    </td>
                    <td>
                      {(ins.result_status === 'pending' || ins.result_status === 'assigned') && (
                        <button className="admin-btn admin-btn--primary"
                          onClick={() => assign(ins.id)}
                          disabled={assigning===ins.id || !selected[ins.id]}
                          style={{fontSize:12,padding:'4px 10px'}}>
                          {assigning===ins.id ? '…' : '📤 ส่งงาน'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminWebShell>
  );
}
