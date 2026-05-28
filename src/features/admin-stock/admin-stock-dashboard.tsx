'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Warehouse = { id: string; code: string; name: string };
type StockItem = {
  id: string; qty_on_hand: number; qty_reserved: number; qty_available: number; unit: string;
  warehouses: { id: string; code: string; name: string } | null;
  products:       { id: string; name: string; category: string; price_per_unit: number } | null;
};
type Movement = {
  id: string; movement_no: string; movement_type: string; product_name: string;
  unit: string; qty: number; unit_cost: number | null; unit_price: number | null;
  total_amount: number | null; ref_no: string | null; note: string | null; created_at: string;
  ref_type: string | null; ref_id: string | null;
  buyer_name: string | null; buyer_phone: string | null; ref_order_number: string | null;
  seller_name: string | null;
  warehouses: { name: string } | null;
};
type ReceiveEdit = { id: string; movement_no: string; qty: string; unit_cost: string; note: string } | null;

const TYPE_CFG: Record<string, { icon: string; label: string; color: string }> = {
  receive:      { icon: '📥', label: 'รับเข้า',    color: '#2e7d32' },
  sale:         { icon: '💰', label: 'ขายออก',    color: '#c62828' },
  reservation:  { icon: '📋', label: 'จอง',        color: '#e65100' },
  cancel_res:   { icon: '↩️', label: 'ยกเลิกจอง', color: '#9e9e9e' },
  transfer_out: { icon: '📤', label: 'โอนออก',     color: '#1565c0' },
  transfer_in:  { icon: '📨', label: 'โอนเข้า',    color: '#1565c0' },
  adjust_add:   { icon: '➕', label: 'ปรับเพิ่ม',  color: '#2e7d32' },
  adjust_sub:   { icon: '➖', label: 'ปรับลด',     color: '#c62828' },
  return:       { icon: '↩️', label: 'รับคืน',     color: '#6a1b9a' },
  opening:      { icon: '🏁', label: 'ยอดยกมา',   color: '#455a64' },
};

type ReceiveForm = {
  warehouse_id: string; product_type: string; product_id: string;
  unit: string; qty: string; unit_cost: string; note: string;
};

export function AdminStockDashboard() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock,      setStock]      = useState<StockItem[]>([]);
  const [movements,  setMovements]  = useState<Movement[]>([]);
  const [products,   setProducts]   = useState<{ id: string; name: string; unit: string; category: string; product_type?: string | null }[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selWH,      setSelWH]      = useState('');
  const [tab,        setTab]        = useState<'stock' | 'receive' | 'transfer' | 'movements'>('stock');
  const [notice,     setNotice]     = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [editingReceive, setEditingReceive] = useState<ReceiveEdit>(null);

  const [rf, setRf] = useState<ReceiveForm>({
    warehouse_id: '', product_type: '', product_id: '',
    unit: 'ชิ้น', qty: '', unit_cost: '', note: '',
  });

  // transfer form
  const [tf, setTf] = useState({ from_wh: '', to_wh: '', product_id: '', product_name: '', unit: 'ชิ้น', qty: '', note: '' });

  async function load() {
    setLoading(true);
    const [whRes, stockRes, mvRes, prodRes] = await Promise.all([
      fetch('/api/admin/warehouses', { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/admin/stock-movements/summary${selWH ? `?warehouse_id=${selWH}` : ''}`).then((r) => r.json()),
      fetch(`/api/admin/stock-movements?limit=50${selWH ? `&warehouse_id=${selWH}` : ''}`).then((r) => r.json()),
      fetch('/api/admin/products', { credentials: 'include' }).then((r) => r.json()),
    ]);
    setWarehouses(whRes.warehouses ?? []);
    setStock(stockRes.stock ?? []);
    setMovements(mvRes.movements ?? []);
    setProducts(prodRes.products ?? []);
    if (!selWH && whRes.warehouses?.[0]) setSelWH(whRes.warehouses[0].id);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [selWH]);

  async function receive() {
    if (!rf.warehouse_id || !rf.product_id || !rf.qty || !rf.product_type) {
      setNotice('❌ กรุณากรอกข้อมูลให้ครบ'); return;
    }
    setSaving(true); setNotice(null);
    const res = await fetch('/api/admin/stock-movements', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movement_type: 'receive', warehouse_id: rf.warehouse_id,
        product_id:    rf.product_id,
        product_name:  products.find((p) => p.id === rf.product_id)?.name ?? '',
        unit: rf.unit, qty: Number(rf.qty),
        unit_cost: rf.unit_cost ? Number(rf.unit_cost) : null,
        note: rf.note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ รับเข้าสต๊อกแล้ว');
    setRf({ warehouse_id: '', product_type: '', product_id: '', unit: 'ชิ้น', qty: '', unit_cost: '', note: '' });
    void load();
  }

  async function transfer() {
    if (!tf.from_wh || !tf.to_wh || !tf.qty || !tf.product_id) {
      setNotice('❌ กรุณากรอกข้อมูลให้ครบ'); return;
    }
    if (tf.from_wh === tf.to_wh) { setNotice('❌ คลังต้น-ปลายทางต้องต่างกัน'); return; }
    setSaving(true); setNotice(null);
    const res = await fetch('/api/admin/stock-movements', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movement_type: 'transfer_out', warehouse_id: tf.from_wh,
        dest_warehouse_id: tf.to_wh,
        product_id:    tf.product_id,
        product_name:  tf.product_name,
        unit: tf.unit, qty: Number(tf.qty),
        note: tf.note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ โอนสต๊อกแล้ว');
    setTf({ from_wh: '', to_wh: '', product_id: '', product_name: '', unit: 'ชิ้น', qty: '', note: '' });
    void load();
  }

  async function saveReceiveCorrection() {
    if (!editingReceive) return;
    const qty = Number(editingReceive.qty);
    if (!qty || qty <= 0) { setNotice('❌ จำนวนต้องมากกว่า 0'); return; }
    setSaving(true); setNotice(null);
    const res = await fetch('/api/admin/stock-movements', { credentials: 'include', 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movement_id: editingReceive.id,
        qty,
        unit_cost: editingReceive.unit_cost ? Number(editingReceive.unit_cost) : null,
        note: editingReceive.note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error ?? 'แก้ไขไม่สำเร็จ'}`); return; }
    setEditingReceive(null);
    setNotice('✅ บันทึกการแก้ไขรับเข้าแล้ว');
    void load();
  }

  if (loading) return <LoadingState label="กำลังโหลดสต๊อก…" />;

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {/* warehouse selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {warehouses.map((wh) => (
          <button key={wh.id} onClick={() => setSelWH(wh.id)}
            style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', borderColor: selWH === wh.id ? 'var(--primary)' : '#e0e0e0', background: selWH === wh.id ? 'var(--primary)' : '#fff', color: selWH === wh.id ? '#fff' : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            🏭 {wh.name}
          </button>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #e0e0e0', paddingBottom: 8 }}>
        {([
          { key: 'stock',     label: '📦 สต๊อก' },
          { key: 'receive',   label: '📥 รับเข้า' },
          { key: 'transfer',  label: '📤 โอน' },
          { key: 'movements', label: '📊 เคลื่อนไหว' },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t.key ? 'var(--primary)' : '#f0f4f0', color: tab === t.key ? '#fff' : 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STOCK tab */}
      {tab === 'stock' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>สินค้า/พันธุ์</th><th>คลัง</th><th>มีในมือ</th><th>จอง</th><th>พร้อมขาย</th><th>หน่วย</th></tr></thead>
            <tbody>
              {stock.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>ยังไม่มีสต๊อก</td></tr>}
              {stock.map((s) => {
                const name = s.products?.name ?? '—';
                const cat  = s.products?.category ?? '';
                return (
                  <tr key={s.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 700 }}>{name}</p>
                      {cat && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{cat}</p>}
                    </td>
                    <td>{s.warehouses?.name ?? '—'}</td>
                    <td style={{ fontWeight: 800, color: '#1b5e20' }}>{s.qty_on_hand.toLocaleString()}</td>
                    <td style={{ color: '#e65100' }}>{s.qty_reserved.toLocaleString()}</td>
                    <td style={{ fontWeight: 800, color: s.qty_available <= 0 ? '#c62828' : '#1b5e20' }}>{s.qty_available.toLocaleString()}</td>
                    <td>{s.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RECEIVE tab */}
      {tab === 'receive' && (
        <div style={{ display: 'grid', gap: 12 }}>
        <div className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>📥 รับเข้าสต๊อก</p>
            <a href="/admin/products" className="admin-btn admin-btn--ghost" style={{ textDecoration: 'none' }}>
              🧾 Product Master
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="reg-label">คลัง <span className="reg-required">*</span>
              <select className="reg-input" value={rf.warehouse_id} onChange={(e) => setRf((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">เลือกคลัง</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="reg-label">ประเภทสินค้า <span className="reg-required">*</span>
              <select className="reg-input" value={rf.product_type} onChange={(e) => setRf((p) => ({ ...p, product_type: e.target.value, product_id: '' }))}>
                <option value="">เลือกประเภท</option>
                {[...new Set(products.map((p) => p.product_type || 'other'))].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="reg-label">สินค้า <span className="reg-required">*</span>
              <select className="reg-input" value={rf.product_id} onChange={(e) => { const id=e.target.value; const prod=products.find((x)=>x.id===id); setRf((p)=>({ ...p, product_id:id, unit:prod?.unit ?? 'ชิ้น' })); }}>
                <option value="">เลือกสินค้า</option>
                {products.filter((p) => (p.product_type || 'other') === rf.product_type).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="reg-label">จำนวน <span className="reg-required">*</span>
              <input className="reg-input" type="number" value={rf.qty} onChange={(e) => setRf((p) => ({ ...p, qty: e.target.value }))} placeholder="0" />
            </label>
            <label className="reg-label">หน่วย
              <input className="reg-input" value={rf.unit} onChange={(e) => setRf((p) => ({ ...p, unit: e.target.value }))} />
            </label>
            <label className="reg-label">ราคาทุน/หน่วย
              <input className="reg-input" type="number" value={rf.unit_cost} onChange={(e) => setRf((p) => ({ ...p, unit_cost: e.target.value }))} placeholder="0.00" />
            </label>
            <label className="reg-label">หมายเหตุ
              <input className="reg-input" value={rf.note} onChange={(e) => setRf((p) => ({ ...p, note: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="admin-btn admin-btn--primary" onClick={receive} disabled={saving}>{saving ? 'กำลังบันทึก…' : '📥 บันทึกรับเข้า'}</button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>เลขที่</th><th>สินค้า</th><th>ผู้ขาย/Supplier</th><th>จำนวน</th><th>ทุน/หน่วย</th><th>หมายเหตุ</th><th>เวลา</th><th /></tr></thead>
            <tbody>
              {movements.filter((m) => m.movement_type === 'receive').slice(0, 20).map((mv) => (
                <tr key={mv.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{mv.movement_no}</td>
                  <td>{mv.product_name}</td>
                  <td>{mv.seller_name ?? '—'}</td>
                  <td style={{ fontWeight: 700 }}>{mv.qty.toLocaleString()} {mv.unit}</td>
                  <td>{mv.unit_cost ? mv.unit_cost.toLocaleString() : '—'}</td>
                  <td style={{ maxWidth: 200 }}>{mv.note || '—'}</td>
                  <td style={{ fontSize: 12 }}>{new Date(mv.created_at).toLocaleString('th-TH')}</td>
                  <td>
                    <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}
                      onClick={() => setEditingReceive({ id: mv.id, movement_no: mv.movement_no, qty: String(mv.qty), unit_cost: mv.unit_cost ? String(mv.unit_cost) : '', note: mv.note ?? '' })}>
                      ✏️ แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {movements.filter((m) => m.movement_type === 'receive').length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>ยังไม่มีประวัติรับเข้า</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* TRANSFER tab */}
      {tab === 'transfer' && (
        <div className="kaona-card">
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 15 }}>📤 โอนสต๊อกระหว่างคลัง</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="reg-label">จากคลัง <span className="reg-required">*</span>
              <select className="reg-input" value={tf.from_wh} onChange={(e) => setTf((p) => ({ ...p, from_wh: e.target.value }))}>
                <option value="">เลือกคลัง</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="reg-label">ไปคลัง <span className="reg-required">*</span>
              <select className="reg-input" value={tf.to_wh} onChange={(e) => setTf((p) => ({ ...p, to_wh: e.target.value }))}>
                <option value="">เลือกคลัง</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="reg-label" style={{ gridColumn: '1/-1' }}>สินค้า <span className="reg-required">*</span>
              <select className="reg-input" value={tf.product_id} onChange={(e) => { const id=e.target.value; const prod=products.find((x)=>x.id===id); setTf((p)=>({ ...p, product_id:id, product_name:prod?.name ?? '', unit:prod?.unit ?? 'ชิ้น' })); }}>
                <option value="">เลือกสินค้า</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
              </select>
            </label>
            <label className="reg-label">จำนวน <span className="reg-required">*</span>
              <input className="reg-input" type="number" value={tf.qty} onChange={(e) => setTf((p) => ({ ...p, qty: e.target.value }))} />
            </label>
            <label className="reg-label">หมายเหตุ
              <input className="reg-input" value={tf.note} onChange={(e) => setTf((p) => ({ ...p, note: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="admin-btn admin-btn--primary" onClick={transfer} disabled={saving}>{saving ? 'กำลังโอน…' : '📤 ยืนยันโอน'}</button>
          </div>
        </div>
      )}

      {/* MOVEMENTS tab */}
      {tab === 'movements' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>เลขที่</th><th>ประเภท</th><th>สินค้า</th><th>คลัง</th><th>จำนวน</th><th>👤 ผู้ซื้อ / อ้างอิง</th><th>ยอดเงิน</th><th>วันที่</th></tr></thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>ยังไม่มีรายการ</td></tr>}
              {movements.map((mv) => {
                const cfg = TYPE_CFG[mv.movement_type] ?? { icon: '•', label: mv.movement_type, color: '#666' };
                const isOut = ['sale','transfer_out','adjust_sub','reservation'].includes(mv.movement_type);
                return (
                  <tr key={mv.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      <div>{mv.movement_no}</div>
                      {mv.ref_order_number && (
                        <div style={{ marginTop: 2, fontSize: 11, color: '#9CA3AF' }}>บิลขาย: {mv.ref_order_number}</div>
                      )}
                    </td>
                    <td><span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.icon} {cfg.label}</span></td>
                    <td>{mv.product_name}</td>
                    <td style={{ fontSize: 12 }}>{mv.warehouses?.name ?? '—'}</td>
                    <td style={{ fontWeight: 800, color: isOut ? '#c62828' : '#2e7d32' }}>
                      {isOut ? '−' : '+'}{mv.qty.toLocaleString()} {mv.unit}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {mv.buyer_name ? (
                        <div>
                          <span style={{ fontWeight: 600 }}>👤 {mv.buyer_name}</span>
                          {(mv.ref_order_number || mv.buyer_phone) && (
                            <div style={{ color: '#9CA3AF', fontSize: 11 }}>
                              {mv.buyer_phone}{mv.ref_order_number ? ` · ${mv.ref_order_number}` : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>{mv.ref_order_number ?? mv.note ?? '—'}</span>
                      )}
                    </td>
                    <td>{mv.total_amount ? mv.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{new Date(mv.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingReceive && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingReceive(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ แก้ไขรับเข้า {editingReceive.movement_no}</h2>
              <button className="admin-modal__close" onClick={() => setEditingReceive(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
                ระบบจะไม่แก้รายการเดิม แต่จะสร้างรายการปรับแก้เพื่อเก็บประวัติ
              </p>
              <label className="reg-label">จำนวนใหม่
                <input className="reg-input" type="number" value={editingReceive.qty} onChange={(e) => setEditingReceive((p) => p ? { ...p, qty: e.target.value } : p)} />
              </label>
              <label className="reg-label">ราคาทุน/หน่วย
                <input className="reg-input" type="number" value={editingReceive.unit_cost} onChange={(e) => setEditingReceive((p) => p ? { ...p, unit_cost: e.target.value } : p)} />
              </label>
              <label className="reg-label">หมายเหตุแก้ไข
                <input className="reg-input" value={editingReceive.note} onChange={(e) => setEditingReceive((p) => p ? { ...p, note: e.target.value } : p)} />
              </label>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setEditingReceive(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={saveReceiveCorrection} disabled={saving}>{saving ? 'กำลังบันทึก…' : '💾 บันทึกแก้ไข'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
