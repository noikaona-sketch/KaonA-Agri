'use client';

import { useEffect, useState } from 'react';

type Row = {
  id: string; scheduled_date: string; status: string; intake_source: string | null;
  estimated_tonnage: number | null; actual_received_kg: number | null;
  estimated_moisture: number | null; actual_moisture_pct: number | null;
  net_weight_kg: number | null; net_amount: number | null; quality_grade: string | null;
  members: { full_name: string; phone: string | null } | null;
  pickup_locations: { name: string } | null;
};
type Summary = {
  total_bookings: number; completed: number;
  total_expected_kg: number; total_actual_kg: number; accuracy_pct: number | null;
  avg_moisture_exp: number | null; avg_moisture_act: number | null; total_revenue: number;
};

const fmt    = (n: number | null) => n == null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtT   = (n: number | null) => n == null ? '—' : (n / 1000).toFixed(1) + ' ต.';
const thDate = (s: string) => new Date(s).toLocaleDateString('th-TH', { day:'numeric', month:'short' });

const GRADE_COLOR: Record<string, string> = { A:'#059669', B:'#d97706', C:'#dc2626', reject:'#6b7280' };
const SOURCE_LABEL: Record<string, string> = { manual:'กรอกเอง', factory_api:'เครื่องชั่ง', csv_import:'CSV' };

function DeltaCell({ expected, actual, unit = 'กก.' }: { expected: number | null; actual: number | null; unit?: string }) {
  if (!expected || !actual) return <span style={{ color:'#9ca3af' }}>—</span>;
  const delta = actual - expected;
  const pct   = Math.round((delta / expected) * 100);
  return (
    <span style={{ color: Math.abs(pct) > 20 ? '#dc2626' : Math.abs(pct) > 10 ? '#d97706' : '#059669', fontWeight:500 }}>
      {delta >= 0 ? '+' : ''}{fmt(delta)} {unit} ({delta >= 0 ? '+' : ''}{pct}%)
    </span>
  );
}

export function ExpectedVsActualReport() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState(30);

  async function load(days: number) {
    setLoading(true);
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
    const d    = await fetch(`/api/admin/reports/expected-vs-actual?from=${from}&to=${to}`)
      .then(r => r.json()) as { rows?: Row[]; summary?: Summary };
    setRows(d.rows ?? []);
    setSummary(d.summary ?? null);
    setLoading(false);
  }
  useEffect(() => { void load(range); }, [range]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:8 }}>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setRange(d)}
            className={`admin-btn ${range===d?'admin-btn--primary':'admin-btn--secondary'}`}
            style={{ fontSize:12, padding:'5px 12px' }}>{d} วัน</button>
        ))}
      </div>

      {/* KPI */}
      {summary && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { label:'booking ทั้งหมด',  value:`${summary.total_bookings}`,            color:'#374151' },
            { label:'เสร็จแล้ว',        value:`${summary.completed}`,                color:'#059669' },
            { label:'คาดการณ์รวม',     value:fmtT(summary.total_expected_kg),        color:'#1d4ed8' },
            { label:'รับจริงรวม',       value:fmtT(summary.total_actual_kg),          color:'#7c3aed' },
            { label:'ความแม่นยำ',      value:summary.accuracy_pct!=null ? `${summary.accuracy_pct}%` : '—',
              color: summary.accuracy_pct==null ? '#9ca3af' : summary.accuracy_pct>=90?'#059669':summary.accuracy_pct>=70?'#d97706':'#dc2626' },
            { label:'ยอดรวม',           value:`฿${fmt(summary.total_revenue)}`,       color:'#059669' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex:1, minWidth:100, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
              <p style={{ margin:'0 0 2px', fontSize:11, color:'#9ca3af' }}>{label}</p>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ความชื้นเฉลี่ย */}
      {summary && (summary.avg_moisture_exp || summary.avg_moisture_act) && (
        <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'10px 14px', display:'flex', gap:24 }}>
          <div><p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>ความชื้นที่คาดการณ์ (เฉลี่ย)</p><p style={{ margin:0, fontWeight:700 }}>{summary.avg_moisture_exp ?? '—'}%</p></div>
          <div><p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>ความชื้นจริง (เฉลี่ย)</p><p style={{ margin:0, fontWeight:700 }}>{summary.avg_moisture_act ?? '—'}%</p></div>
          {summary.avg_moisture_exp && summary.avg_moisture_act && (
            <div>
              <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>ผลต่าง</p>
              <p style={{ margin:0, fontWeight:700, color: Math.abs(summary.avg_moisture_act - summary.avg_moisture_exp) > 3 ? '#dc2626' : '#059669' }}>
                {(summary.avg_moisture_act - summary.avg_moisture_exp).toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? <p style={{ color:'#9ca3af', textAlign:'center', padding:24 }}>กำลังโหลด…</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>สมาชิก</th><th>วันที่</th><th>จุด</th>
                <th style={{textAlign:'right'}}>คาด (ตัน)</th>
                <th style={{textAlign:'right'}}>จริง (ตัน)</th>
                <th>ผลต่าง</th>
                <th style={{textAlign:'right'}}>ชื้นคาด</th>
                <th style={{textAlign:'right'}}>ชื้นจริง</th>
                <th>เกรด</th>
                <th style={{textAlign:'right'}}>ยอด</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{textAlign:'center',color:'#9ca3af',padding:24}}>ไม่มีข้อมูล</td></tr>
              )}
              {rows.map(r => {
                const m   = r.members as { full_name: string; phone: string | null } | null;
                const loc = r.pickup_locations as { name: string } | null;
                const estKg = (r.estimated_tonnage ?? 0) * 1000;
                return (
                  <tr key={r.id}>
                    <td>
                      <p style={{margin:'0 0 1px',fontWeight:600,fontSize:13}}>{m?.full_name ?? '—'}</p>
                      <p style={{margin:0,fontSize:11,color:'#9ca3af'}}>{m?.phone ?? ''}</p>
                    </td>
                    <td style={{fontSize:12,color:'#6b7280',whiteSpace:'nowrap'}}>{thDate(r.scheduled_date)}</td>
                    <td style={{fontSize:12,color:'#6b7280'}}>{loc?.name ?? '—'}</td>
                    <td style={{textAlign:'right',fontSize:12}}>{fmtT(estKg || null)}</td>
                    <td style={{textAlign:'right',fontWeight:r.actual_received_kg?600:400,color:r.actual_received_kg?'#1f2937':'#9ca3af'}}>
                      {fmtT(r.actual_received_kg)}
                    </td>
                    <td><DeltaCell expected={estKg||null} actual={r.actual_received_kg} /></td>
                    <td style={{textAlign:'right',fontSize:12,color:'#6b7280'}}>{r.estimated_moisture ? `${r.estimated_moisture}%` : '—'}</td>
                    <td style={{textAlign:'right',fontSize:12,fontWeight:r.actual_moisture_pct?600:400}}>
                      {r.actual_moisture_pct ? `${r.actual_moisture_pct}%` : '—'}
                    </td>
                    <td>
                      {r.quality_grade && (
                        <span style={{fontSize:11,padding:'2px 7px',borderRadius:6,background:GRADE_COLOR[r.quality_grade]+'22',color:GRADE_COLOR[r.quality_grade],fontWeight:600}}>
                          {r.quality_grade}
                        </span>
                      )}
                    </td>
                    <td style={{textAlign:'right',fontWeight:600,color:'#059669',fontSize:13}}>
                      {r.net_amount ? `฿${fmt(r.net_amount)}` : '—'}
                    </td>
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
