'use client';

import { useEffect, useState } from 'react';
import { ExportCSV } from '@/shared/components/export-csv';

type VehicleRow = { license_plate:string; vehicle_type:string|null; driver_name:string; trips:number; total_kg:number; total_revenue:number; avg_moisture:number|null; grade_a:number; grade_b:number; grade_c:number; grade_reject:number };

const fmt  = (n:number) => n.toLocaleString('th-TH',{maximumFractionDigits:0});
const fmtT = (n:number) => `${(n/1000).toFixed(1)} ต.`;

function GradeBar({ a,b,c,r }: { a:number;b:number;c:number;r:number }) {
  const total = a+b+c+r || 1;
  return (
    <div style={{display:'flex',height:12,borderRadius:99,overflow:'hidden',minWidth:80,gap:1}}>
      {a>0&&<div style={{flex:a/total,background:'#059669'}} title={`A: ${a}`}/>}
      {b>0&&<div style={{flex:b/total,background:'#d97706'}} title={`B: ${b}`}/>}
      {c>0&&<div style={{flex:c/total,background:'#dc2626'}} title={`C: ${c}`}/>}
      {r>0&&<div style={{flex:r/total,background:'#9ca3af'}} title={`reject: ${r}`}/>}
    </div>
  );
}

export function ByVehicleReport() {
  const [rows,    setRows]    = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState(90);

  async function load(days:number) {
    setLoading(true);
    const to   = new Date().toISOString().slice(0,10);
    const from = new Date(Date.now()-(days-1)*86400_000).toISOString().slice(0,10);
    const d    = await fetch(`/api/admin/reports/by-vehicle?from=${from}&to=${to}`).then(r=>r.json()) as {rows?:VehicleRow[]};
    setRows(d.rows??[]);
    setLoading(false);
  }
  useEffect(()=>{ void load(range); },[range]);

  const exportData = rows.map(r=>({
    ทะเบียน: r.license_plate, ประเภท:r.vehicle_type??'', คนขับ:r.driver_name,
    เที่ยว:r.trips, น้ำหนักรวม_ตัน:(r.total_kg/1000).toFixed(1),
    ความชื้นเฉลี่ย:r.avg_moisture??'', เกรดA:r.grade_a, เกรดB:r.grade_b, เกรดC:r.grade_c, reject:r.grade_reject,
    ยอดเงินรวม:r.total_revenue,
  }));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:8,justifyContent:'space-between',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:6}}>
          {[30,90,180].map(d=>(
            <button key={d} onClick={()=>setRange(d)}
              className={`admin-btn ${range===d?'admin-btn--primary':'admin-btn--secondary'}`}
              style={{fontSize:12,padding:'5px 12px'}}>{d===180?'6 เดือน':`${d} วัน`}</button>
          ))}
        </div>
        <ExportCSV data={exportData} filename={`by-vehicle-${range}d.csv`} />
      </div>

      {loading && <p style={{color:'#9ca3af',textAlign:'center',padding:24}}>กำลังโหลด…</p>}

      {!loading && rows.length===0 && (
        <p style={{color:'#9ca3af',textAlign:'center',padding:24}}>ไม่มีข้อมูลในช่วงที่เลือก</p>
      )}

      {!loading && rows.length>0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>ทะเบียน / คนขับ</th><th style={{textAlign:'right'}}>เที่ยว</th><th style={{textAlign:'right'}}>น้ำหนักรวม</th><th style={{textAlign:'right'}}>ชื้นเฉลี่ย</th><th>คุณภาพ (A/B/C)</th><th style={{textAlign:'right'}}>ยอดรวม</th></tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.license_plate}>
                  <td style={{color:'#9ca3af',fontSize:12}}>{i+1}</td>
                  <td>
                    <p style={{margin:'0 0 1px',fontWeight:700,fontSize:13}}>{r.license_plate}</p>
                    <p style={{margin:0,fontSize:11,color:'#6b7280'}}>{r.driver_name}{r.vehicle_type?` · ${r.vehicle_type}`:''}</p>
                  </td>
                  <td style={{textAlign:'right',fontWeight:500}}>{r.trips}</td>
                  <td style={{textAlign:'right',fontWeight:600}}>{fmtT(r.total_kg)}</td>
                  <td style={{textAlign:'right',color:r.avg_moisture&&r.avg_moisture>28?'#dc2626':r.avg_moisture&&r.avg_moisture>25?'#d97706':'#059669',fontWeight:500}}>
                    {r.avg_moisture!=null?`${r.avg_moisture}%`:'—'}
                  </td>
                  <td>
                    <GradeBar a={r.grade_a} b={r.grade_b} c={r.grade_c} r={r.grade_reject}/>
                    <p style={{margin:'2px 0 0',fontSize:10,color:'#9ca3af'}}>A:{r.grade_a} B:{r.grade_b} C:{r.grade_c}{r.grade_reject>0?` ❌${r.grade_reject}`:''}</p>
                  </td>
                  <td style={{textAlign:'right',color:'#059669',fontWeight:700}}>฿{fmt(r.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
