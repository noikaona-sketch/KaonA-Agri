'use client';

import { useEffect, useState } from 'react';

type Movement = {
  id:string; movement_no?:string; movement_type:string;
  warehouse_id:string|null; product_id:string|null;
  qty:number; unit:string; ref_type:string|null; ref_id:string|null;
  ref_order_number:string|null; note:string|null; created_at:string;
  buyer_name:string|null; buyer_phone:string|null; buyer_id:string|null;
  seller_name:string|null;
  warehouses?:{ name:string }|null;
  product?:{ name:string; bag_weight_kg:number|null }|null;
  creator?:{ id:string; full_name:string }|null;
};

type Warehouse = { id:string; name:string };
type Product = { id:string; name:string; unit?:string|null; is_active?:boolean };


const TYPE_CFG: Record<string,{icon:string;label:string;color:string;bg:string}> = {
  sale:         { icon:'📤', label:'ขายออก',      color:'#c62828', bg:'#FEF2F2' },
  out:          { icon:'📤', label:'ขายออก',      color:'#c62828', bg:'#FEF2F2' },
  transfer_out: { icon:'📤', label:'โอนออก',      color:'#c62828', bg:'#FEF2F2' },
  adjust_sub:   { icon:'➖', label:'ปรับลด',      color:'#c62828', bg:'#FEF2F2' },
  receive:      { icon:'📥', label:'รับเข้า',      color:'#2e7d32', bg:'#F0FDF4' },
  in:           { icon:'📥', label:'รับเข้า',      color:'#2e7d32', bg:'#F0FDF4' },
  transfer_in:  { icon:'📥', label:'โอนเข้า',      color:'#2e7d32', bg:'#F0FDF4' },
  adjust_add:   { icon:'➕', label:'ปรับเพิ่ม',     color:'#2e7d32', bg:'#F0FDF4' },
  adjust:       { icon:'🔧', label:'ปรับยอด',      color:'#1565c0', bg:'#EFF6FF' },
  return:       { icon:'↩️', label:'คืนของ',      color:'#e65100', bg:'#FFF7ED' },
};

const REF_TYPE_LABEL: Record<string,string> = {
  sale:             'ขายออก',
  sale_order:       'ขายออก',
  reservation:      'จอง',
  seed_reservation: 'จอง',
  manual:           'manual',
  transfer:         'โอน',
};

export function StockMovementPanel() {
  const [movements,       setMovements]       = useState<Movement[]>([]);
  const [warehouses,      setWarehouses]      = useState<Warehouse[]>([]);
  const [products,        setProducts]        = useState<Product[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [typeFilter,      setTypeFilter]      = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [productFilter,   setProductFilter]   = useState('');

  useEffect(() => {
    void Promise.all([loadWarehouses(), loadProducts()]);
  }, []);

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, typeFilter, warehouseFilter, productFilter]);

  async function loadWarehouses() {
    const res = await fetch('/api/admin/warehouses', { credentials:'include' });
    const d = (await res.json()) as { warehouses?:Warehouse[] };
    setWarehouses(d.warehouses ?? []);
  }

  async function loadProducts() {
    const res = await fetch('/api/admin/products', { credentials:'include' });
    const d = (await res.json()) as { products?:Product[] };
    setProducts(d.products ?? []);
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit:'200' });
    if (dateFrom)        params.set('date_from',    dateFrom);
    if (dateTo)          params.set('date_to',      dateTo);
    if (typeFilter)      params.set('type',         typeFilter);
    if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
    if (productFilter)   params.set('product_id',   productFilter);
    const res = await fetch(`/api/admin/stock-movements?${params}`, { credentials:'include' });
    const d   = (await res.json()) as { movements?:Movement[] };
    setMovements(d.movements ?? []);
    setLoading(false);
  }

  const outTypes = new Set(['sale','out','transfer_out','adjust_sub']);
  const inTypes  = new Set(['receive','in','transfer_in','adjust_add','return']);

  // stats
  const totalOut  = movements.filter(m=>outTypes.has(m.movement_type)).reduce((s,m)=>s+m.qty,0);
  const totalIn   = movements.filter(m=>inTypes.has(m.movement_type)).reduce((s,m)=>s+m.qty,0);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flex:1, flexWrap:'wrap' }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>จากวันที่</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>ถึงวันที่</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />
          <select value={warehouseFilter} onChange={e=>setWarehouseFilter(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }}>
            <option value="">ทุกคลัง</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
          </select>
          <select value={productFilter} onChange={e=>setProductFilter(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, minWidth:180 }}>
            <option value="">ทุกสินค้า</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }}>
            <option value="">ทุกประเภท</option>
            {Object.entries(TYPE_CFG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter(''); setWarehouseFilter(''); setProductFilter(''); }}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', fontSize:12, cursor:'pointer' }}>
            ล้าง filter
          </button>
          <button onClick={load}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', fontSize:13, cursor:'pointer' }}>
            🔄
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'รายการทั้งหมด', value:movements.length,  color:'#374151' },
          { label:'📤 จ่ายออกรวม', value:`${totalOut} ถุง`, color:'#DC2626' },
          { label:'📥 รับเข้ารวม', value:`${totalIn} ถุง`,  color:'#059669' },
        ].map(k => (
          <div key={k.label} style={{ flex:1, minWidth:120, background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:18, fontWeight:800, color:k.color }}>{k.value}</p>
            <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
        {loading && <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</p>}
        {!loading && movements.length === 0 && (
          <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>ไม่พบรายการ</p>
        )}
        {!loading && movements.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:760 }}>
              <thead>
                <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                  {['เลขที่','ประเภท','สินค้า','คลัง','จำนวน','ผู้ขาย / ผู้ซื้อ / อ้างอิง','วันที่'].map((h,i) => (
                    <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => {
                  const cfg = TYPE_CFG[m.movement_type] ?? TYPE_CFG.adjust;
                  const isOut = outTypes.has(m.movement_type);
                  return (
                    <tr key={m.id} style={{ borderBottom:idx<movements.length-1?'1px solid #F3F4F6':'none' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='#F9FAFB')}
                      onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                      <td style={{ padding:'11px 14px', fontSize:11, color:'#9CA3AF', fontFamily:'monospace' }}>
                        <div>{m.movement_no ?? m.id.slice(0,8)}</div>
                        {m.ref_order_number && (
                          <div style={{ marginTop:2, fontFamily:'inherit', fontSize:10, color:'#6B7280' }}>SO: {m.ref_order_number}</div>
                        )}
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ fontSize:12, padding:'2px 8px', borderRadius:99, background:cfg.bg, color:cfg.color, fontWeight:700 }}>
                          {cfg.icon} {m.ref_type ? (REF_TYPE_LABEL[m.ref_type] ?? m.ref_type) : cfg.label}
                        </span>
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>
                        {m.product?.name ?? '—'}
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:'#6B7280' }}>
                        {(m.warehouses as {name:string}|null)?.name ?? '—'}
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ fontSize:14, fontWeight:800, color:isOut?'#DC2626':'#059669' }}>
                          {isOut?'-':'+'}{m.qty}
                        </span>
                        <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:4 }}>{m.unit}</span>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        {['receive', 'in'].includes(m.movement_type) ? (
                          <span style={{ fontSize:12, color:m.seller_name ? '#374151' : '#9CA3AF' }}>
                            {m.seller_name ?? '—'}
                          </span>
                        ) : m.buyer_name ? (
                          <div>
                            <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#111' }}>👤 {m.buyer_name}</p>
                            <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>
                              {m.buyer_phone ?? ''}{m.ref_order_number ? ` · ${m.ref_order_number}` : ''}
                            </p>
                          </div>
                        ) : (
                          <span style={{ fontSize:12, color:'#9CA3AF' }}>
                            {m.ref_order_number ?? m.note ?? '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:'#6B7280', whiteSpace:'nowrap' }}>
                        {new Date(m.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short'})}
                        {' '}
                        {new Date(m.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
