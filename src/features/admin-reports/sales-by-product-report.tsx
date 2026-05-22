'use client';

import { useEffect, useState } from 'react';

type ByProduct = { product_id: string; product_name: string; category: string; unit: string; total_qty: number; total_revenue: number };
type DailyRow  = { date: string; product_name: string; category: string; unit: string; qty: number; revenue: number };

const CATEGORY_ICON: Record<string, string> = { seed:'🌽', fertilizer:'🌿', pesticide:'⚗️', equipment:'🔧', other:'📦' };
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const thDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day:'numeric', month:'short' });

export function SalesByProductReport() {
  const [byProduct, setByProduct] = useState<ByProduct[]>([]);
  const [daily,     setDaily]     = useState<DailyRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<'product' | 'daily'>('product');
  const [range,     setRange]     = useState(30);

  async function load(days: number) {
    setLoading(true);
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
    const res  = await fetch(`/api/admin/reports/sales-by-product?from=${from}&to=${to}`);
    const d    = (await res.json()) as { by_product?: ByProduct[]; daily?: DailyRow[] };
    setByProduct(d.by_product ?? []);
    setDaily(d.daily ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(range); }, [range]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* controls */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6 }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setRange(d)}
              className={`admin-btn ${range===d ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize:12, padding:'5px 12px' }}>{d} วัน</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setView('product')} className={`admin-btn ${view==='product' ? 'admin-btn--primary' : 'admin-btn--secondary'}`} style={{ fontSize:12, padding:'5px 12px' }}>📦 รวมตามสินค้า</button>
          <button onClick={() => setView('daily')}   className={`admin-btn ${view==='daily'   ? 'admin-btn--primary' : 'admin-btn--secondary'}`} style={{ fontSize:12, padding:'5px 12px' }}>📅 รายวัน</button>
        </div>
      </div>

      {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>}

      {/* ยอดรวมตามสินค้า */}
      {!loading && view === 'product' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สินค้า</th><th>หมวด</th><th style={{ textAlign:'right' }}>จำนวนที่ขาย</th><th style={{ textAlign:'right' }}>รายได้รวม</th></tr>
            </thead>
            <tbody>
              {byProduct.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>ไม่มีข้อมูลการขายในช่วงนี้</td></tr>
              )}
              {byProduct.map((r) => (
                <tr key={r.product_id}>
                  <td style={{ fontWeight:600 }}>{r.product_name}</td>
                  <td><span style={{ fontSize:12 }}>{CATEGORY_ICON[r.category] ?? '📦'} {r.category}</span></td>
                  <td style={{ textAlign:'right', fontWeight:500 }}>{fmt(r.total_qty)} {r.unit}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#1b5e20' }}>฿{fmt(r.total_revenue)}</td>
                </tr>
              ))}
              {byProduct.length > 0 && (
                <tr style={{ background:'var(--color-background-secondary)', fontWeight:700 }}>
                  <td colSpan={2}>รวม</td>
                  <td></td>
                  <td style={{ textAlign:'right', color:'#1b5e20' }}>฿{fmt(byProduct.reduce((s,r) => s+r.total_revenue, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* รายวัน */}
      {!loading && view === 'daily' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>วันที่</th><th>สินค้า</th><th style={{ textAlign:'right' }}>จำนวน</th><th style={{ textAlign:'right' }}>รายได้</th></tr>
            </thead>
            <tbody>
              {daily.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>ไม่มีข้อมูลการขายในช่วงนี้</td></tr>
              )}
              {daily.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{thDate(r.date)}</td>
                  <td>{CATEGORY_ICON[r.category] ?? '📦'} {r.product_name}</td>
                  <td style={{ textAlign:'right' }}>{fmt(r.qty)} {r.unit}</td>
                  <td style={{ textAlign:'right', fontWeight:600, color:'#1b5e20' }}>฿{fmt(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
