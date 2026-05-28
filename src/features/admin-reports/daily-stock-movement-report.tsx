'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Warehouse = { id: string; code: string; name: string };
type Product = { id: string; name: string; unit: string; category: string };
type DailyMovementRow = {
  date: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_key: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  category: string;
  unit: string;
  opening_balance: number;
  received_qty: number;
  transfer_in_qty: number;
  transfer_out_qty: number;
  sold_out_qty: number;
  reserved_qty: number;
  ending_balance: number;
};

type DailyMovementResponse = {
  from: string;
  to: string;
  rows?: DailyMovementRow[];
  totals?: Pick<DailyMovementRow, 'opening_balance' | 'received_qty' | 'transfer_in_qty' | 'transfer_out_qty' | 'sold_out_qty' | 'reserved_qty' | 'ending_balance'>;
  error?: string;
};

const dayMs = 86_400_000;
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);

function qtyCell(value: number, unit?: string, color = '#374151') {
  return (
    <td style={{ textAlign:'right', color, fontWeight: value ? 600 : 400, whiteSpace:'nowrap' }}>
      {value ? fmt(value) : '—'} {value && unit ? unit : ''}
    </td>
  );
}

export function DailyStockMovementReport() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<DailyMovementRow[]>([]);
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    opening_balance: sum.opening_balance + row.opening_balance,
    received_qty: sum.received_qty + row.received_qty,
    transfer_in_qty: sum.transfer_in_qty + row.transfer_in_qty,
    transfer_out_qty: sum.transfer_out_qty + row.transfer_out_qty,
    sold_out_qty: sum.sold_out_qty + row.sold_out_qty,
    reserved_qty: sum.reserved_qty + row.reserved_qty,
    ending_balance: sum.ending_balance + row.ending_balance,
  }), {
    opening_balance: 0,
    received_qty: 0,
    transfer_in_qty: 0,
    transfer_out_qty: 0,
    sold_out_qty: 0,
    reserved_qty: 0,
    ending_balance: 0,
  }), [rows]);

  const loadFilters = useCallback(async function loadFilters() {
    const [whRes, prodRes] = await Promise.all([
      fetch('/api/admin/warehouses', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/products', { credentials: 'include' }).then((r) => r.json()),
    ]);
    setWarehouses(whRes.warehouses ?? []);
    setProducts(prodRes.products ?? []);
  }, []);

  const loadReport = useCallback(async function loadReport() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to });
    if (warehouseId) params.set('warehouse_id', warehouseId);
    if (productId) params.set('product_id', productId);
    if (search.trim()) params.set('q', search.trim());

    const res = await fetch(`/api/admin/reports/stock-daily-movement?${params.toString()}`, { credentials: 'include' });
    const data = (await res.json()) as DailyMovementResponse;
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'โหลดรายงานไม่สำเร็จ');
      setRows([]);
      return;
    }
    setRows(data.rows ?? []);
  }, [from, to, warehouseId, productId, search]);

  useEffect(() => { void loadFilters(); }, [loadFilters]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'var(--color-background-secondary)', borderRadius:14, padding:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'end' }}>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          จากวันที่
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="admin-input" style={{ minWidth:150 }} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          ถึงวันที่
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="admin-input" style={{ minWidth:150 }} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          คลังสินค้า
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="admin-input" style={{ minWidth:180 }}>
            <option value="">ทุกคลัง</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          สินค้า
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="admin-input" style={{ minWidth:220 }}>
            <option value="">ทุกสินค้า</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563', flex:1, minWidth:180 }}>
          ค้นหาชื่อสินค้า/หมวด
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void loadReport(); }} className="admin-input" placeholder="เช่น seed, ปุ๋ย, ชื่อสินค้า" />
        </label>
        <button onClick={loadReport} className="admin-btn admin-btn--primary" style={{ padding:'9px 14px' }}>🔍 ดูรายงาน</button>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:130, border:'1px solid #e5e7eb', borderRadius:12, padding:12 }}>
          <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>แถวรายงาน</p>
          <p style={{ margin:0, fontSize:20, fontWeight:600 }}>{fmt(rows.length)}</p>
        </div>
        <div style={{ flex:1, minWidth:130, border:'1px solid #dcfce7', background:'#f0fdf4', borderRadius:12, padding:12 }}>
          <p style={{ margin:'0 0 2px', fontSize:11, color:'#166534' }}>รับเข้า + โอนเข้า</p>
          <p style={{ margin:0, fontSize:20, fontWeight:600, color:'#166534' }}>{fmt(totals.received_qty + totals.transfer_in_qty)}</p>
        </div>
        <div style={{ flex:1, minWidth:130, border:'1px solid #fee2e2', background:'#fef2f2', borderRadius:12, padding:12 }}>
          <p style={{ margin:'0 0 2px', fontSize:11, color:'#991b1b' }}>ออก + จอง</p>
          <p style={{ margin:0, fontSize:20, fontWeight:600, color:'#991b1b' }}>{fmt(totals.transfer_out_qty + totals.sold_out_qty + totals.reserved_qty)}</p>
        </div>
      </div>

      {error && <p style={{ color:'#b91c1c', fontSize:13, margin:0 }}>❌ {error}</p>}
      {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>คลัง</th>
                <th>สินค้า</th>
                <th style={{ textAlign:'right' }}>ยอดยกมา</th>
                <th style={{ textAlign:'right' }}>รับเข้า</th>
                <th style={{ textAlign:'right' }}>โอนเข้า</th>
                <th style={{ textAlign:'right' }}>โอนออก</th>
                <th style={{ textAlign:'right' }}>ขาย/ออก</th>
                <th style={{ textAlign:'right' }}>จอง</th>
                <th style={{ textAlign:'right' }}>คงเหลือปลายวัน</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>
              )}
              {rows.map((r) => (
                <tr key={`${r.date}-${r.warehouse_id}-${r.product_key}`}>
                  <td style={{ whiteSpace:'nowrap' }}>{r.date}</td>
                  <td>
                    <p style={{ margin:0, fontWeight:600 }}>{r.warehouse_code || '—'}</p>
                    <span style={{ fontSize:11, color:'#6b7280' }}>{r.warehouse_name}</span>
                  </td>
                  <td>
                    <p style={{ margin:0, fontWeight:600 }}>{r.product_name}</p>
                    <span style={{ fontSize:11, color:'#6b7280' }}>{r.category} · {r.unit}</span>
                  </td>
                  {qtyCell(r.opening_balance, r.unit)}
                  {qtyCell(r.received_qty, r.unit, '#166534')}
                  {qtyCell(r.transfer_in_qty, r.unit, '#1565c0')}
                  {qtyCell(r.transfer_out_qty, r.unit, '#c2410c')}
                  {qtyCell(r.sold_out_qty, r.unit, '#b91c1c')}
                  {qtyCell(r.reserved_qty, r.unit, '#d97706')}
                  {qtyCell(r.ending_balance, r.unit, '#111827')}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                  <td colSpan={3}>รวมตามแถวที่แสดง</td>
                  {qtyCell(totals.opening_balance)}
                  {qtyCell(totals.received_qty, undefined, '#166534')}
                  {qtyCell(totals.transfer_in_qty, undefined, '#1565c0')}
                  {qtyCell(totals.transfer_out_qty, undefined, '#c2410c')}
                  {qtyCell(totals.sold_out_qty, undefined, '#b91c1c')}
                  {qtyCell(totals.reserved_qty, undefined, '#d97706')}
                  {qtyCell(totals.ending_balance)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
