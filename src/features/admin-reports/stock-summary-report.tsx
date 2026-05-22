'use client';

import { useEffect, useState } from 'react';

type StockRow = {
  product_id: string; product_name: string; category: string; unit: string;
  price_per_unit: number; qty_available: number; qty_reserved: number; qty_sold: number;
  stock_value: number; in_30d: number; out_30d: number;
};

const CATEGORY_ICON: Record<string, string> = { seed:'🌽', fertilizer:'🌿', pesticide:'⚗️', equipment:'🔧', other:'📦' };
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

function StockBar({ available, reserved }: { available: number; reserved: number }) {
  const total = available + reserved;
  if (total === 0) return <span style={{ fontSize:11, color:'#9ca3af' }}>—</span>;
  const resPct = Math.round((reserved / total) * 100);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <div style={{ flex:1, background:'#e5e7eb', borderRadius:99, height:6, overflow:'hidden', minWidth:50 }}>
        <div style={{ width:`${resPct}%`, height:'100%', borderRadius:99, background:'#f59e0b' }} />
      </div>
      <span style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>{fmt(available)}</span>
    </div>
  );
}

export function StockSummaryReport() {
  const [stock,   setStock]   = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVal, setTotalVal] = useState(0);
  const [filter,  setFilter]  = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/reports/stock-summary');
    const d   = (await res.json()) as { stock?: StockRow[]; total_stock_value?: number };
    setStock(d.stock ?? []);
    setTotalVal(d.total_stock_value ?? 0);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filtered = stock.filter((r) =>
    !filter || r.category === filter || r.product_name.includes(filter)
  );

  const lowStock  = stock.filter((r) => r.qty_available <= 100 && r.qty_available >= 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI summary */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:120, background:'var(--color-background-secondary)', borderRadius:12, padding:'12px 14px' }}>
          <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>📦 สินค้าทั้งหมด</p>
          <p style={{ margin:0, fontSize:20, fontWeight:500 }}>{stock.length} รายการ</p>
        </div>
        <div style={{ flex:1, minWidth:120, background:'var(--color-background-secondary)', borderRadius:12, padding:'12px 14px' }}>
          <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>💰 มูลค่าสต็อกรวม</p>
          <p style={{ margin:0, fontSize:20, fontWeight:500, color:'#1b5e20' }}>฿{fmt(totalVal)}</p>
        </div>
        {lowStock.length > 0 && (
          <div style={{ flex:1, minWidth:120, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'12px 14px' }}>
            <p style={{ margin:'0 0 2px', fontSize:11, color:'#991b1b' }}>⚠️ สต็อกต่ำ</p>
            <p style={{ margin:0, fontSize:20, fontWeight:500, color:'#991b1b' }}>{lowStock.length} รายการ</p>
          </div>
        )}
      </div>

      {/* filter */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {['', 'seed', 'fertilizer', 'pesticide', 'equipment', 'other'].map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`admin-btn ${filter===cat ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize:12, padding:'5px 10px' }}>
            {cat ? `${CATEGORY_ICON[cat]} ${cat}` : '🔍 ทั้งหมด'}
          </button>
        ))}
        <button onClick={load} className="admin-btn admin-btn--secondary" style={{ fontSize:12, padding:'5px 10px', marginLeft:'auto' }}>🔄 รีเฟรช</button>
      </div>

      {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>หมวด</th>
                <th style={{ textAlign:'right' }}>ว่าง</th>
                <th style={{ textAlign:'right' }}>จอง</th>
                <th style={{ textAlign:'right' }}>เข้า 30 วัน</th>
                <th style={{ textAlign:'right' }}>ออก 30 วัน</th>
                <th style={{ textAlign:'right' }}>มูลค่า</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>ไม่พบข้อมูล</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.product_id} style={{ background: r.qty_available <= 100 ? '#fff8f8' : undefined }}>
                  <td>
                    <p style={{ margin:0, fontWeight:600 }}>{r.product_name}</p>
                    {r.qty_available <= 100 && r.qty_available >= 0 && (
                      <span style={{ fontSize:10, color:'#991b1b', fontWeight:500 }}>⚠️ สต็อกต่ำ</span>
                    )}
                  </td>
                  <td style={{ fontSize:12 }}>{CATEGORY_ICON[r.category] ?? '📦'}</td>
                  <td style={{ textAlign:'right' }}>
                    <StockBar available={r.qty_available} reserved={r.qty_reserved} />
                  </td>
                  <td style={{ textAlign:'right', fontSize:12, color:'#f59e0b', fontWeight:500 }}>{fmt(r.qty_reserved)} {r.unit}</td>
                  <td style={{ textAlign:'right', fontSize:12, color:'#1565c0' }}>+{fmt(r.in_30d)}</td>
                  <td style={{ textAlign:'right', fontSize:12, color:'#c62828' }}>-{fmt(r.out_30d)}</td>
                  <td style={{ textAlign:'right', fontWeight:600, color:'#1b5e20' }}>฿{fmt(r.stock_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
