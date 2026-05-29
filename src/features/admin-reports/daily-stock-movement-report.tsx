'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Warehouse = { id: string; code: string; name: string };
type Product = { id: string; name: string; unit: string; category: string };
type ReportMode = 'detail' | 'summary';
type MovementTypeFilter = '' | 'receive' | 'transfer_in' | 'transfer_out' | 'sale_out' | 'adjust' | 'reservation';

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

type DetailMovementRow = {
  id: string;
  date: string;
  created_at: string;
  movement_no: string;
  movement_type: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  category: string;
  unit: string;
  qty: number;
  unit_cost: number | null;
  unit_price: number | null;
  total_amount: number | null;
  ref_type: string | null;
  ref_id: string | null;
  ref_no: string | null;
  note: string | null;
  seller_name: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  ref_order_number: string | null;
};

type MovementTotals = {
  received_qty: number;
  transfer_in_qty: number;
  transfer_out_qty: number;
  sold_out_qty: number;
  reserved_qty: number;
  ending_balance: number;
  row_count: number;
};

type DailyMovementResponse = {
  from: string;
  to: string;
  rows?: DailyMovementRow[];
  detail_rows?: DetailMovementRow[];
  totals?: Partial<MovementTotals & Pick<DailyMovementRow, 'opening_balance'>>;
  error?: string;
};

const dayMs = 86_400_000;
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
const money = (n: number | null) => n == null ? '—' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);

const MOVEMENT_OPTIONS: { value: MovementTypeFilter; label: string }[] = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'receive', label: 'รับเข้า' },
  { value: 'transfer_in', label: 'โอนเข้า' },
  { value: 'transfer_out', label: 'โอนออก' },
  { value: 'sale_out', label: 'ขาย/ออก' },
  { value: 'adjust', label: 'ปรับสต๊อก' },
  { value: 'reservation', label: 'จอง/ยกเลิกจอง' },
];

const TYPE_LABEL: Record<string, { label: string; color: string; sign: '-' | '+' | '' }> = {
  receive: { label: 'รับเข้า', color: '#166534', sign: '+' },
  transfer_in: { label: 'โอนเข้า', color: '#1565c0', sign: '+' },
  transfer_out: { label: 'โอนออก', color: '#c2410c', sign: '-' },
  sale: { label: 'ขาย/ออก', color: '#b91c1c', sign: '-' },
  reservation: { label: 'จอง', color: '#d97706', sign: '-' },
  cancel_res: { label: 'ยกเลิกจอง', color: '#6b7280', sign: '+' },
  adjust_add: { label: 'ปรับเพิ่ม', color: '#166534', sign: '+' },
  adjust_sub: { label: 'ปรับลด', color: '#b91c1c', sign: '-' },
  return: { label: 'รับคืน', color: '#6a1b9a', sign: '+' },
  opening: { label: 'ยอดยกมา', color: '#455a64', sign: '' },
};

function qtyCell(value: number, unit?: string, color = '#374151') {
  return (
    <td style={{ textAlign:'right', color, fontWeight: value ? 600 : 400, whiteSpace:'nowrap' }}>
      {value ? fmt(value) : '—'} {value && unit ? unit : ''}
    </td>
  );
}

function KpiCard({ label, value, color, background = '#fff', border = '#e5e7eb' }: { label: string; value: string; color?: string; background?: string; border?: string }) {
  return (
    <div style={{ flex:1, minWidth:135, border:`1px solid ${border}`, background, borderRadius:12, padding:12 }}>
      <p style={{ margin:'0 0 2px', fontSize:11, color: color ?? '#6b7280' }}>{label}</p>
      <p style={{ margin:0, fontSize:20, fontWeight:700, color: color ?? '#111827' }}>{value}</p>
    </div>
  );
}

export function DailyStockMovementReport() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<DailyMovementRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailMovementRow[]>([]);
  const [mode, setMode] = useState<ReportMode>('detail');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState<MovementTypeFilter>('');
  const [search, setSearch] = useState('');
  const [serverTotals, setServerTotals] = useState<DailyMovementResponse['totals']>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fallbackTotals = useMemo<MovementTotals>(() => {
    const source = mode === 'detail' ? detailRows : rows;
    return source.reduce<MovementTotals>((sum, row) => {
      if ('movement_type' in row) {
        const qty = row.qty;
        if (['receive', 'adjust_add', 'return'].includes(row.movement_type)) sum.received_qty += qty;
        if (row.movement_type === 'transfer_in') sum.transfer_in_qty += qty;
        if (row.movement_type === 'transfer_out') sum.transfer_out_qty += qty;
        if (['sale', 'adjust_sub'].includes(row.movement_type)) sum.sold_out_qty += qty;
        if (row.movement_type === 'reservation') sum.reserved_qty += qty;
        if (row.movement_type === 'cancel_res') sum.reserved_qty -= qty;
      } else {
        sum.received_qty += row.received_qty;
        sum.transfer_in_qty += row.transfer_in_qty;
        sum.transfer_out_qty += row.transfer_out_qty;
        sum.sold_out_qty += row.sold_out_qty;
        sum.reserved_qty += row.reserved_qty;
        sum.ending_balance += row.ending_balance;
      }
      sum.row_count += 1;
      return sum;
    }, { received_qty:0, transfer_in_qty:0, transfer_out_qty:0, sold_out_qty:0, reserved_qty:0, ending_balance:0, row_count:0 });
  }, [detailRows, mode, rows]);

  const totals: MovementTotals = {
    received_qty: serverTotals?.received_qty ?? fallbackTotals.received_qty,
    transfer_in_qty: serverTotals?.transfer_in_qty ?? fallbackTotals.transfer_in_qty,
    transfer_out_qty: serverTotals?.transfer_out_qty ?? fallbackTotals.transfer_out_qty,
    sold_out_qty: serverTotals?.sold_out_qty ?? fallbackTotals.sold_out_qty,
    reserved_qty: serverTotals?.reserved_qty ?? fallbackTotals.reserved_qty,
    ending_balance: serverTotals?.ending_balance ?? fallbackTotals.ending_balance,
    row_count: serverTotals?.row_count ?? fallbackTotals.row_count,
  };

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
    const params = new URLSearchParams({ from, to, mode });
    if (warehouseId) params.set('warehouse_id', warehouseId);
    if (productId) params.set('product_id', productId);
    if (movementType) params.set('movement_type', movementType);
    if (search.trim()) params.set('q', search.trim());

    const res = await fetch(`/api/admin/reports/stock-daily-movement?${params.toString()}`, { credentials: 'include' });
    const data = (await res.json()) as DailyMovementResponse;
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'โหลดรายงานไม่สำเร็จ');
      setRows([]);
      setDetailRows([]);
      setServerTotals(undefined);
      return;
    }
    setRows(data.rows ?? []);
    setDetailRows(data.detail_rows ?? []);
    setServerTotals(data.totals);
  }, [from, mode, movementType, productId, search, to, warehouseId]);

  useEffect(() => { void loadFilters(); }, [loadFilters]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'var(--color-background-secondary)', borderRadius:14, padding:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          รูปแบบรายงาน
          <div style={{ display:'flex', gap:6, background:'#fff', border:'1px solid #d1d5db', borderRadius:10, padding:4 }}>
            {([
              { value: 'detail', label: 'ละเอียด' },
              { value: 'summary', label: 'สรุปต่อวัน' },
            ] as const).map((option) => (
              <button key={option.value} type="button" onClick={() => setMode(option.value)} className={`admin-btn ${mode === option.value ? 'admin-btn--primary' : 'admin-btn--ghost'}`} style={{ padding:'6px 10px' }}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
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
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563' }}>
          ประเภทเคลื่อนไหว
          <select value={movementType} onChange={(e) => setMovementType(e.target.value as MovementTypeFilter)} className="admin-input" style={{ minWidth:180 }}>
            {MOVEMENT_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'#4b5563', flex:1, minWidth:200 }}>
          ค้นหา
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void loadReport(); }} className="admin-input" placeholder="สินค้า, หมวด, คลัง, MV, SO/ref, ผู้ขาย" />
        </label>
        <button onClick={loadReport} className="admin-btn admin-btn--primary" style={{ padding:'9px 14px' }}>🔍 ดูรายงาน</button>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <KpiCard label="แถวรายงาน" value={fmt(totals.row_count)} />
        <KpiCard label="รับเข้า" value={fmt(totals.received_qty)} color="#166534" background="#f0fdf4" border="#dcfce7" />
        <KpiCard label="โอนเข้า" value={fmt(totals.transfer_in_qty)} color="#1565c0" background="#eff6ff" border="#dbeafe" />
        <KpiCard label="โอนออก" value={fmt(totals.transfer_out_qty)} color="#c2410c" background="#fff7ed" border="#fed7aa" />
        <KpiCard label="ขาย/ออก" value={fmt(totals.sold_out_qty)} color="#b91c1c" background="#fef2f2" border="#fee2e2" />
        <KpiCard label="จองสุทธิ" value={fmt(totals.reserved_qty)} color="#d97706" background="#fffbeb" border="#fde68a" />
        <KpiCard label="คงเหลือปลายทาง" value={fmt(totals.ending_balance)} color="#111827" background="#f9fafb" border="#e5e7eb" />
      </div>

      {error && <p style={{ color:'#b91c1c', fontSize:13, margin:0 }}>❌ {error}</p>}
      {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>}

      {!loading && mode === 'detail' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>MV / อ้างอิง</th>
                <th>ประเภท</th>
                <th>คลัง</th>
                <th>สินค้า</th>
                <th style={{ textAlign:'right' }}>จำนวน</th>
                <th>ผู้ขาย/ผู้ซื้อ</th>
                <th style={{ textAlign:'right' }}>มูลค่า</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>
              )}
              {detailRows.map((r) => {
                const cfg = TYPE_LABEL[r.movement_type] ?? { label: r.movement_type, color: '#374151', sign: '' };
                const person = r.seller_name || r.buyer_name;
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace:'nowrap' }}>
                      <p style={{ margin:0 }}>{r.date}</p>
                      <span style={{ fontSize:11, color:'#6b7280' }}>{new Date(r.created_at).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })}</span>
                    </td>
                    <td style={{ fontFamily:'monospace', fontSize:12 }}>
                      <p style={{ margin:0, fontWeight:700 }}>{r.movement_no}</p>
                      <span style={{ color:'#6b7280' }}>{r.ref_order_number ?? r.ref_no ?? '—'}</span>
                    </td>
                    <td><span style={{ color:cfg.color, fontWeight:700 }}>{cfg.label}</span></td>
                    <td>
                      <p style={{ margin:0, fontWeight:600 }}>{r.warehouse_code || '—'}</p>
                      <span style={{ fontSize:11, color:'#6b7280' }}>{r.warehouse_name}</span>
                    </td>
                    <td>
                      <p style={{ margin:0, fontWeight:600 }}>{r.product_name}</p>
                      <span style={{ fontSize:11, color:'#6b7280' }}>{r.category} · {r.unit}</span>
                    </td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap', color:cfg.color, fontWeight:800 }}>{cfg.sign}{fmt(r.qty)} {r.unit}</td>
                    <td style={{ fontSize:12 }}>
                      {person ? <p style={{ margin:0, fontWeight:600 }}>{person}</p> : <span style={{ color:'#9ca3af' }}>—</span>}
                      {r.buyer_phone && <span style={{ color:'#6b7280' }}>{r.buyer_phone}</span>}
                    </td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{money(r.total_amount)}</td>
                    <td style={{ fontSize:12, color:'#6b7280' }}>{r.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && mode === 'summary' && (
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
          </table>
        </div>
      )}
    </div>
  );
}
