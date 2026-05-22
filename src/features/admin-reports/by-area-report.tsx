'use client';

import { useEffect, useState } from 'react';

type AreaRow = {
  label: string; province: string | null;
  member_count: number; cycle_count: number;
  total_rai: number; total_yield_kg: number; yield_per_rai: number | null;
  no_burn_count: number; no_burn_approved_count?: number; no_burn_pct: number | null;
};

const fmt    = (n: number, d = 0) => n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtK   = (n: number) => n >= 1000 ? `${fmt(n / 1000, 1)} ต.` : `${fmt(n)} กก.`;

type SortKey = 'total_rai' | 'total_yield_kg' | 'member_count' | 'no_burn_pct' | 'yield_per_rai';

export function ByAreaReport() {
  const [rows,    setRows]    = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [level,   setLevel]   = useState<'district' | 'subdistrict' | 'group'>('district');
  const [sortBy,  setSortBy]  = useState<SortKey>('total_rai');
  const [range,   setRange]   = useState(365);

  async function load(lv: typeof level, days: number) {
    setLoading(true);
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
    const res  = await fetch(`/api/admin/reports/by-area?level=${lv}&from=${from}&to=${to}`);
    const d    = (await res.json()) as { rows?: AreaRow[] };
    setRows(d.rows ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(level, range); }, [level, range]);

  const sorted = [...rows].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  // summary totals
  const totalRai    = rows.reduce((s, r) => s + r.total_rai, 0);
  const totalYield  = rows.reduce((s, r) => s + r.total_yield_kg, 0);
  const totalMembers = rows.reduce((s, r) => s + r.member_count, 0);
  const totalNoBurn = rows.reduce((s, r) => s + r.no_burn_count, 0);
  const totalCycles = rows.reduce((s, r) => s + r.cycle_count, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {([
            { key:'district',    label:'อำเภอ' },
            { key:'subdistrict', label:'ตำบล'  },
            { key:'group',       label:'กลุ่ม'  },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setLevel(t.key)}
              className={`admin-btn ${level===t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize:12, padding:'5px 12px' }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[90, 180, 365].map((d) => (
            <button key={d} onClick={() => setRange(d)}
              className={`admin-btn ${range===d ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize:12, padding:'5px 12px' }}>{d === 365 ? '1 ปี' : `${d} วัน`}</button>
          ))}
        </div>
      </div>

      {/* KPI */}
      {!loading && rows.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            { icon:'📍', label: level==='group' ? 'กลุ่ม' : level==='subdistrict' ? 'ตำบล' : 'อำเภอ', value:`${rows.length} แห่ง` },
            { icon:'👥', label:'สมาชิก',        value:`${fmt(totalMembers)} คน`      },
            { icon:'🌾', label:'พื้นที่รวม',     value:`${fmt(totalRai, 1)} ไร่`      },
            { icon:'🌽', label:'ผลผลิตรวม',     value:fmtK(totalYield)               },
            { icon:'🌿', label:'ไม่เผา',         value:`${totalCycles > 0 ? Math.round(totalNoBurn/totalCycles*100) : 0}%` },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ flex:1, minWidth:90, background:'var(--color-background-secondary)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
              <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>{icon} {label}</p>
              <p style={{ margin:0, fontSize:16, fontWeight:500 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sort controls */}
      {!loading && rows.length > 0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#9ca3af' }}>เรียงตาม:</span>
          {([
            { key:'total_rai',     label:'พื้นที่'   },
            { key:'total_yield_kg',label:'ผลผลิต'   },
            { key:'member_count',  label:'สมาชิก'   },
            { key:'yield_per_rai', label:'ผลผลิต/ไร่' },
            { key:'no_burn_pct',   label:'% ไม่เผา' },
          ] as const).map((s) => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`admin-btn ${sortBy===s.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize:11, padding:'4px 8px' }}>{s.label}</button>
          ))}
        </div>
      )}

      {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>}

      {!loading && rows.length === 0 && (
        <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>ไม่มีข้อมูลในช่วงที่เลือก</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{level === 'group' ? 'กลุ่ม' : level === 'subdistrict' ? 'ตำบล' : 'อำเภอ'}</th>
                <th style={{ textAlign:'right' }}>สมาชิก</th>
                <th style={{ textAlign:'right' }}>พื้นที่ (ไร่)</th>
                <th style={{ textAlign:'right' }}>ผลผลิตรวม</th>
                <th style={{ textAlign:'right' }}>ผลผลิต/ไร่</th>
                <th style={{ textAlign:'center' }}>ไม่เผา</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const noBurnPct = r.no_burn_pct ?? 0;
                const noBurnColor = noBurnPct >= 60 ? '#166534' : noBurnPct >= 30 ? '#854d0e' : '#9ca3af';
                return (
                  <tr key={i}>
                    <td>
                      <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{r.label}</p>
                      {r.province && <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>{r.province}</p>}
                    </td>
                    <td style={{ textAlign:'right' }}>{fmt(r.member_count)} คน</td>
                    <td style={{ textAlign:'right', fontWeight:500 }}>{fmt(r.total_rai, 1)}</td>
                    <td style={{ textAlign:'right', fontWeight:500, color:'#1b5e20' }}>{fmtK(r.total_yield_kg)}</td>
                    <td style={{ textAlign:'right', fontSize:12, color:'#6b7280' }}>
                      {r.yield_per_rai ? `${fmt(r.yield_per_rai, 0)} กก.` : '—'}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: noBurnColor }}>
                        {noBurnPct > 0 ? `🌿 ${noBurnPct}%` : '—'}
                      </span>
                      <p style={{ margin:0, fontSize:10, color:'#9ca3af' }}>
                        {r.no_burn_count}/{r.cycle_count} รอบ
                      </p>
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
