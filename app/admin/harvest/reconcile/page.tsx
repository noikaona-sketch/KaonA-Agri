'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminWebShell }                    from '@/shared/components/admin-web-shell';

type BookingRow = {
  id: string; status: string; scheduled_date: string; actual_completed_at: string | null; locked_at: string | null;
  gross_weight_kg: number | null; net_weight_kg: number | null; net_amount: number | null;
  actual_moisture_pct: number | null; quality_grade: string | null;
  estimated_tonnage: number | null; intake_source: string | null;
  members: { full_name: string; phone: string | null } | null;
  pickup_locations: { name: string } | null;
};
type Summary = {
  date: string; total: number; completed: number; pending: number;
  rejected: number; no_show: number;
  total_net_weight_kg: number; total_net_amount: number; all_locked: boolean;
};
type Location = { id: string; name: string };

const fmt    = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  completed: { color:'#166534', bg:'#f0fdf4', label:'✅ เสร็จแล้ว' },
  planned:   { color:'#1d4ed8', bg:'#eff6ff', label:'🕐 รอรับ'    },
  confirmed: { color:'#0369a1', bg:'#f0f9ff', label:'✓ ยืนยัน'   },
  rejected:  { color:'#dc2626', bg:'#fef2f2', label:'❌ ปฏิเสธ'   },
  no_show:   { color:'#6b7280', bg:'#f9fafb', label:'⛔ ไม่มา'    },
};

export default function ReconcilePage() {
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState('');
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [rows,       setRows]       = useState<BookingRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [closing,    setClosing]    = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/admin/pickup-slots').then(r => r.json())
      .then((d: { locations?: Location[] }) => {
        const locs = d.locations ?? [];
        setLocations(locs);
        if (locs[0]) setLocationId(locs[0].id);
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ date });
    if (locationId) q.set('location_id', locationId);
    const d = await fetch(`/api/admin/harvest/reconcile?${q}`).then(r => r.json()) as { summary?: Summary; rows?: BookingRow[] };
    setSummary(d.summary ?? null);
    setRows(d.rows ?? []);
    setLoading(false);
  }, [date, locationId]);

  useEffect(() => { void load(); }, [load]);

  async function closeDay() {
    if (!confirm(`ปิดรับวัน ${date}?\n- คิวที่ยังไม่มา → no-show\n- บันทึกที่เสร็จแล้ว → lock ไม่ให้แก้ไข`)) return;
    setClosing(true);
    const res = await fetch('/api/admin/harvest/reconcile', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'close', date, location_id:locationId||undefined }),
    });
    setClosing(false);
    const d = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ ปิดรับวันนี้แล้ว');
    await load();
  }

  async function exportCsv() {
    const res = await fetch('/api/admin/harvest/reconcile', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'export', date, location_id:locationId||undefined }),
    });
    const d = (await res.json()) as { csv?: string; filename?: string };
    if (!d.csv) return;
    const blob = new Blob([d.csv], { type:'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = d.filename ?? `intake-${date}.csv`; a.click();
  }

  const canClose = !!(summary && (summary.pending > 0 || !summary.all_locked));

  return (
    <AdminWebShell title="📅 ปิดรับวันนี้" subtitle="ตรวจสอบและปิดรอบรับซื้อประจำวัน">
      {notice && (
        <div style={{ background:notice.startsWith('✅')?'#ecfdf5':'#fef2f2', border:`1px solid ${notice.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color:notice.startsWith('✅')?'#14532d':'#991b1b', display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <span>{notice}</span>
          <button onClick={()=>setNotice(null)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:20 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="reg-input" style={{ width:'auto' }} />
        {locations.length > 1 && (
          <select value={locationId} onChange={e => setLocationId(e.target.value)}
            className="reg-input" style={{ width:'auto' }}>
            <option value="">— ทุกจุด —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <button className="admin-btn admin-btn--secondary" onClick={load} style={{ fontSize:13 }}>🔄 โหลด</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="admin-btn admin-btn--secondary" onClick={exportCsv} style={{ fontSize:13 }}>📥 Export CSV</button>
          {canClose && (
            <button className="admin-btn admin-btn--primary" onClick={closeDay} disabled={closing}
              style={{ fontSize:13, background:'#dc2626' }}>
              {closing ? 'กำลังปิด…' : '🔒 ปิดรับวันนี้'}
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      {summary && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
          {[
            { label:'ทั้งหมด',   value:`${summary.total} คิว`,          color:'#374151' },
            { label:'เสร็จแล้ว', value:`${summary.completed} คิว`,      color:'#059669' },
            { label:'รอรับ',     value:`${summary.pending} คิว`,         color:summary.pending>0?'#d97706':'#9ca3af' },
            { label:'ไม่มา',     value:`${summary.no_show} คิว`,         color:'#6b7280' },
            { label:'น้ำหนักรวม',value:`${fmt(summary.total_net_weight_kg/1000)} ตัน`, color:'#1d4ed8' },
            { label:'ยอดรวม',    value:`฿${fmt(summary.total_net_amount)}`,            color:'#059669' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex:1, minWidth:100, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
              <p style={{ margin:'0 0 2px', fontSize:11, color:'#9ca3af' }}>{label}</p>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Booking table */}
      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>จุด</th><th>สถานะ</th><th style={{textAlign:'right'}}>น้ำหนักสุทธิ</th><th style={{textAlign:'right'}}>ยอด</th><th>ชื้น</th><th>Lock</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:'center',color:'#9ca3af',padding:24}}>ไม่มีข้อมูล</td></tr>
              )}
              {rows.map(r => {
                const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.planned;
                const m   = r.members as { full_name: string; phone: string | null } | null;
                const l   = r.pickup_locations as { name: string } | null;
                return (
                  <tr key={r.id}>
                    <td>
                      <p style={{margin:'0 0 1px',fontWeight:600,fontSize:13}}>{m?.full_name ?? '—'}</p>
                      <p style={{margin:0,fontSize:11,color:'#9ca3af'}}>{m?.phone ?? ''}</p>
                    </td>
                    <td style={{fontSize:12,color:'#6b7280'}}>{l?.name ?? '—'}</td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:cfg.bg,color:cfg.color,fontWeight:500}}>{cfg.label}</span></td>
                    <td style={{textAlign:'right',fontWeight:500}}>{r.net_weight_kg ? `${fmt(r.net_weight_kg)} กก.` : '—'}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'#059669'}}>{r.net_amount ? `฿${fmt(r.net_amount)}` : '—'}</td>
                    <td style={{fontSize:12,color:'#6b7280'}}>{r.actual_moisture_pct ? `${r.actual_moisture_pct}%` : '—'}</td>
                    <td style={{textAlign:'center',fontSize:14}}>{r.locked_at ? '🔒' : '—'}</td>
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
