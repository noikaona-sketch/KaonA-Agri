'use client';

import { useEffect, useState } from 'react';
import { ExportCSV } from '@/shared/components/export-csv';

type Summary = { total:number; approved:number; pending:number; rejected:number; new_30d:number; new_7d:number };
type WeekRow = { week:string; count:number };
type DistrictRow = { district:string; count:number };
type RecentRow   = { id:string; full_name:string; phone:string|null; status:string; district:string|null; province:string|null; created_at:string };

const STATUS_CFG: Record<string,{color:string;bg:string;label:string}> = {
  approved: { color:'#059669', bg:'#ecfdf5', label:'อนุมัติแล้ว' },
  pending:  { color:'#d97706', bg:'#fffbeb', label:'รอดำเนินการ' },
  rejected: { color:'#dc2626', bg:'#fef2f2', label:'ปฏิเสธ'      },
};
const thDate = (s:string) => new Date(s).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
const BAR_MAX = 200;

export function MemberSummaryReport() {
  const [summary,  setSummary]  = useState<Summary|null>(null);
  const [weekly,   setWeekly]   = useState<WeekRow[]>([]);
  const [district, setDistrict] = useState<DistrictRow[]>([]);
  const [recent,   setRecent]   = useState<RecentRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    void fetch('/api/admin/reports/member-summary', { credentials: 'include' }).then(r=>r.json())
      .then((d:{summary?:Summary;weekly_new?:WeekRow[];by_district?:DistrictRow[];recent?:RecentRow[]}) => {
        setSummary(d.summary??null);
        setWeekly(d.weekly_new??[]);
        setDistrict(d.by_district??[]);
        setRecent(d.recent??[]);
        setLoading(false);
      });
  }, []);

  const maxWeek = Math.max(1, ...weekly.map(w=>w.count));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI */}
      {summary && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { label:'สมาชิกทั้งหมด',  value:summary.total,    color:'#374151' },
            { label:'อนุมัติแล้ว',     value:summary.approved, color:'#059669' },
            { label:'รอดำเนินการ',     value:summary.pending,  color:summary.pending>0?'#d97706':'#9ca3af' },
            { label:'ใหม่ 30 วัน',    value:summary.new_30d,  color:'#1d4ed8' },
            { label:'ใหม่ 7 วัน',     value:summary.new_7d,   color:'#7c3aed' },
          ].map(({label,value,color}) => (
            <div key={label} style={{flex:1,minWidth:90,background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 14px',textAlign:'center'}}>
              <p style={{margin:'0 0 2px',fontSize:11,color:'#9ca3af'}}>{label}</p>
              <p style={{margin:0,fontSize:20,fontWeight:700,color}}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly bar chart */}
      {weekly.length > 0 && (
        <div className="kaona-card">
          <p style={{margin:'0 0 12px',fontWeight:700}}>📈 สมาชิกใหม่รายสัปดาห์</p>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {weekly.map(w => (
              <div key={w.week} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,color:'#6b7280',width:60,flexShrink:0}}>{w.week}</span>
                <div style={{flex:1,height:18,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.round((w.count/maxWeek)*100)}%`,background:'#3b82f6',borderRadius:4,minWidth:w.count>0?4:0}} />
                </div>
                <span style={{fontSize:12,fontWeight:600,width:24,textAlign:'right',color:'#374151'}}>{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By district */}
      {district.length > 0 && (
        <div className="kaona-card">
          <p style={{margin:'0 0 12px',fontWeight:700}}>📍 สมาชิกที่อนุมัติแล้วตามอำเภอ (Top 10)</p>
          {district.map(d => (
            <div key={d.district} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
              <span style={{fontSize:12,color:'#374151',width:120,flexShrink:0}}>อ.{d.district}</span>
              <div style={{flex:1,height:16,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,Math.round((d.count/Math.max(1,...district.map(x=>x.count)))*100))}%`,background:'#10b981',borderRadius:4}} />
              </div>
              <span style={{fontSize:12,fontWeight:600,width:28,textAlign:'right'}}>{d.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent members */}
      {!loading && recent.length > 0 && (
        <div className="kaona-card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p style={{margin:0,fontWeight:700}}>🆕 สมาชิกล่าสุด</p>
            <ExportCSV data={recent as unknown as Record<string,unknown>[]} filename="members.csv" />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ชื่อ</th><th>เบอร์</th><th>อำเภอ</th><th>สถานะ</th><th>วันที่สมัคร</th></tr></thead>
              <tbody>
                {recent.slice(0,20).map(r => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
                  return (
                    <tr key={r.id}>
                      <td style={{fontWeight:600,fontSize:13}}>{r.full_name}</td>
                      <td style={{fontSize:12,color:'#6b7280'}}>{r.phone??'—'}</td>
                      <td style={{fontSize:12,color:'#6b7280'}}>{r.district ? `อ.${r.district}` : '—'}</td>
                      <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:cfg.bg,color:cfg.color,fontWeight:500}}>{cfg.label}</span></td>
                      <td style={{fontSize:12,color:'#6b7280',whiteSpace:'nowrap'}}>{thDate(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
