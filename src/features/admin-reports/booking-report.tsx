'use client';

import { useEffect, useState } from 'react';
import { ExportCSV } from '@/shared/components/export-csv';

type Summary = { total:number; completed:number; no_show:number; cancelled:number; dryer_req:number; total_actual_kg:number; total_revenue:number };
type DayRow  = { date:string; total:number; completed:number; no_show:number; cancelled:number; expected_kg:number; actual_kg:number; revenue:number };
type Row     = { id:string; scheduled_date:string; status:string; drying_preference:string|null; estimated_tonnage:number|null; actual_received_kg:number|null; net_amount:number|null; members:{full_name:string}|null; pickup_locations:{name:string}|null };

const fmt    = (n:number) => n.toLocaleString('th-TH',{maximumFractionDigits:0});
const fmtT   = (n:number) => n>=1000 ? `${(n/1000).toFixed(1)} ต.` : `${fmt(n)} กก.`;
const thDate = (s:string) => new Date(s).toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'});
const STATUS_CFG: Record<string,{color:string;bg:string;label:string}> = {
  completed: {color:'#059669',bg:'#ecfdf5',label:'✅ เสร็จ'},
  planned:   {color:'#1d4ed8',bg:'#eff6ff',label:'🕐 รอ'},
  confirmed: {color:'#0369a1',bg:'#f0f9ff',label:'✓ ยืนยัน'},
  no_show:   {color:'#6b7280',bg:'#f9fafb',label:'⛔ ไม่มา'},
  cancelled: {color:'#9ca3af',bg:'#f3f4f6',label:'ยกเลิก'},
};

export function BookingReport() {
  const [summary, setSummary] = useState<Summary|null>(null);
  const [daily,   setDaily]   = useState<DayRow[]>([]);
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState(30);
  const [view,    setView]    = useState<'daily'|'list'>('daily');

  async function load(days:number) {
    setLoading(true);
    const to   = new Date().toISOString().slice(0,10);
    const from = new Date(Date.now()-(days-1)*86400_000).toISOString().slice(0,10);
    const d    = await fetch(`/api/admin/reports/bookings?from=${from}&to=${to}`).then(r=>r.json()) as
      { summary?:Summary; daily?:DayRow[]; rows?:Row[] };
    setSummary(d.summary??null);
    setDaily(d.daily??[]);
    setRows(d.rows??[]);
    setLoading(false);
  }
  useEffect(() => { void load(range); }, [range]);

  const exportData = rows.map(r => ({
    วันที่:         r.scheduled_date,
    ชื่อ:           (r.members as {full_name:string}|null)?.full_name ?? '',
    จุดรับ:         (r.pickup_locations as {name:string}|null)?.name  ?? '',
    สถานะ:         r.status,
    น้ำหนักคาด_กก: (r.estimated_tonnage??0)*1000,
    น้ำหนักจริง_กก: r.actual_received_kg??'',
    เข้าอบ:         r.drying_preference==='required'?'ใช่':'ไม่',
    ยอด_บาท:       r.net_amount??'',
  }));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Controls */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:6}}>
          {[7,30,90].map(d=>(
            <button key={d} onClick={()=>setRange(d)}
              className={`admin-btn ${range===d?'admin-btn--primary':'admin-btn--secondary'}`}
              style={{fontSize:12,padding:'5px 12px'}}>{d} วัน</button>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setView('daily')} className={`admin-btn ${view==='daily'?'admin-btn--primary':'admin-btn--secondary'}`} style={{fontSize:12,padding:'5px 12px'}}>📅 รายวัน</button>
          <button onClick={()=>setView('list')}  className={`admin-btn ${view==='list' ?'admin-btn--primary':'admin-btn--secondary'}`} style={{fontSize:12,padding:'5px 12px'}}>📋 รายการ</button>
          <ExportCSV data={exportData} filename={`bookings-${range}d.csv`} />
        </div>
      </div>

      {/* KPI */}
      {summary && (
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[
            {label:'ทั้งหมด',    value:`${summary.total}`,                      color:'#374151'},
            {label:'เสร็จแล้ว', value:`${summary.completed}`,                   color:'#059669'},
            {label:'ไม่มา',     value:`${summary.no_show}`,                     color:summary.no_show>0?'#dc2626':'#9ca3af'},
            {label:'เข้าอบ',    value:`${summary.dryer_req}`,                   color:'#1d4ed8'},
            {label:'รับจริงรวม',value:fmtT(summary.total_actual_kg),            color:'#7c3aed'},
            {label:'ยอดรวม',    value:`฿${fmt(summary.total_revenue)}`,          color:'#059669'},
          ].map(({label,value,color})=>(
            <div key={label} style={{flex:1,minWidth:90,background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 14px',textAlign:'center'}}>
              <p style={{margin:'0 0 2px',fontSize:11,color:'#9ca3af'}}>{label}</p>
              <p style={{margin:0,fontSize:16,fontWeight:700,color}}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p style={{color:'#9ca3af',textAlign:'center',padding:24}}>กำลังโหลด…</p>}

      {/* Daily view */}
      {!loading && view==='daily' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>วัน</th><th>ทั้งหมด</th><th>เสร็จ</th><th>ไม่มา</th><th>คาด (ตัน)</th><th>จริง (ตัน)</th><th style={{textAlign:'right'}}>ยอด</th></tr></thead>
            <tbody>
              {daily.map(d=>(
                <tr key={d.date}>
                  <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{thDate(d.date)}</td>
                  <td>{d.total}</td>
                  <td style={{color:'#059669',fontWeight:500}}>{d.completed}</td>
                  <td style={{color:d.no_show>0?'#dc2626':'#9ca3af'}}>{d.no_show}</td>
                  <td style={{color:'#6b7280'}}>{d.expected_kg>0?fmtT(d.expected_kg):'—'}</td>
                  <td style={{fontWeight:d.actual_kg>0?600:400}}>{d.actual_kg>0?fmtT(d.actual_kg):'—'}</td>
                  <td style={{textAlign:'right',color:'#059669',fontWeight:600}}>{d.revenue>0?`฿${fmt(d.revenue)}`:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* List view */}
      {!loading && view==='list' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>สมาชิก</th><th>วันที่</th><th>จุด</th><th>สถานะ</th><th style={{textAlign:'right'}}>คาด</th><th style={{textAlign:'right'}}>จริง</th><th style={{textAlign:'right'}}>ยอด</th></tr></thead>
            <tbody>
              {rows.map(r=>{
                const cfg=(STATUS_CFG[r.status]??STATUS_CFG.planned);
                return (
                  <tr key={r.id}>
                    <td style={{fontWeight:600,fontSize:13}}>{(r.members as {full_name:string}|null)?.full_name??'—'}</td>
                    <td style={{fontSize:12,color:'#6b7280',whiteSpace:'nowrap'}}>{thDate(r.scheduled_date)}</td>
                    <td style={{fontSize:12,color:'#6b7280'}}>{(r.pickup_locations as {name:string}|null)?.name??'—'}</td>
                    <td><span style={{fontSize:11,padding:'2px 7px',borderRadius:8,background:cfg.bg,color:cfg.color,fontWeight:500}}>{cfg.label}</span></td>
                    <td style={{textAlign:'right',fontSize:12,color:'#6b7280'}}>{r.estimated_tonnage?fmtT(r.estimated_tonnage*1000):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:r.actual_received_kg?600:400}}>{r.actual_received_kg?fmtT(r.actual_received_kg):'—'}</td>
                    <td style={{textAlign:'right',color:'#059669',fontWeight:600,fontSize:13}}>{r.net_amount?`฿${fmt(r.net_amount)}`:'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
