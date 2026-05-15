'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────
type Warehouse = { id: string; code: string; name: string };

type PosItem = {
  id: string; type: 'seed' | 'product';
  variety_id?: string; lot_id?: string; lot_no?: string; product_id?: string;
  name: string; category: string; supplier: string; image_url: string | null;
  unit: string; unit_price: number; qty_available: number; status: string;
};

type Member = { id: string; full_name: string; phone?: string | null };

type CartItem = {
  key: string; type: 'seed' | 'product';
  lot_id?: string; variety_id?: string; product_id?: string;
  name: string; lot_no?: string; category: string; unit: string;
  unit_price: number; qty: number;
};

type Member = { id: string; full_name: string; member_number?: string; phone?: string | null };

type CartItem = {
  key: string;
  product_id?: string;
  variety_id?: string;
  name: string;
  category: string;
  unit: string;
  unit_price: number;
  qty: number;
};

type Session = { id: string; session_no: string; opening_cash: number; status: string };

// ── Member search ────────────────────────────────────────────────────
function MemberSearch({ onSelect }: { onSelect: (m: Member | null) => void }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=8`);
      const d = (await res.json()) as { members?: Member[] };
      setResults(d.members ?? []);
      setOpen(true);
      setLoading(false);
    }, 300);
  }, [q]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '8px 12px', background: '#fff' }}>
        <span>👤</span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="พิมพ์ชื่อหรือรหัสสมาชิก…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
        {loading && <span style={{ fontSize: 12, color: '#9ca3af' }}>…</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
          {results.map((m) => (
            <button key={m.id} onClick={() => { onSelect(m); setQ(m.full_name); setOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 14 }}>
              <span style={{ fontWeight: 700 }}>{m.full_name}</span>
              <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>{m.phone ?? ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main POS ─────────────────────────────────────────────────────────
export function AdminPos() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selWH,      setSelWH]      = useState('');
  const [items,      setItems]      = useState<PosItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('ทั้งหมด');
  const [member,     setMember]     = useState<Member | null>(null);
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [mode,       setMode]       = useState<'sale' | 'reserve'>('sale');
  const [payMethod,  setPayMethod]  = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discount,   setDiscount]   = useState('0');
  const [notice,     setNotice]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt,    setReceipt]    = useState<{ order_no: string; total: number; change: number } | null>(null);
  const [session,    setSession]    = useState<Session | null>(null);

  // load warehouses + session
  useEffect(() => {
    void (async () => {
      const [whRes, sessRes] = await Promise.all([
        fetch('/api/admin/warehouses').then((r) => r.json()),
        fetch('/api/admin/cashier?status=open').then((r) => r.json()),
      ]);
      const whs: Warehouse[] = whRes.warehouses ?? [];
      setWarehouses(whs);
      if (whs[0]) setSelWH(whs[0].id);
      setSession((sessRes.sessions ?? [])[0] ?? null);
    })();
  }, []);

  // load items เมื่อ warehouse เปลี่ยน
  useEffect(() => {
    if (!selWH) return;
    setLoading(true);
    void fetch(`/api/admin/pos-items?warehouse_id=${selWH}`)
      .then((r) => r.json())
      .then((d: { items?: PosItem[] }) => {
        setItems(d.items ?? []);
        setLoading(false);
      });
  }, [selWH]);

  // cart helpers
  const addItem = useCallback((item: PosItem) => {
    const key = item.type === 'seed' ? `s-${item.lot_id}` : `p-${item.product_id}`;
    setCart((prev) => {
      const exists = prev.find((c) => c.key === key);
      if (exists) return prev.map((c) => c.key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        key, type: item.type, name: item.name,
        category: item.category, unit: item.unit, unit_price: item.unit_price,
        qty: 1,
        ...(item.type === 'seed'    ? { lot_id: item.lot_id, variety_id: item.variety_id, lot_no: item.lot_no } : {}),
        ...(item.type === 'product' ? { product_id: item.product_id } : {}),
      }];
    });
  }, []);

  const updateQty = (key: string, qty: number) =>
    setCart((prev) => qty <= 0 ? prev.filter((c) => c.key !== key) : prev.map((c) => c.key === key ? { ...c, qty } : c));

  const subtotal    = cart.reduce((s, c) => s + c.qty * c.unit_price, 0);
  const discountAmt = Number(discount) || 0;
  const total       = Math.max(0, subtotal - discountAmt);
  const change      = payMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - total) : 0;

  // categories
  const categories = ['ทั้งหมด', ...new Set(items.map((s) => s.category))];

  const filtered = items.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.lot_no ?? '').includes(search);
    const matchCat    = catFilter === 'ทั้งหมด' || s.category === catFilter;
    return matchSearch && matchCat;
  });

  async function submit() {
    if (!member) { setNotice('❌ กรุณาเลือกสมาชิก'); return; }
    if (cart.length === 0) { setNotice('❌ กรุณาเพิ่มสินค้า'); return; }
    if (mode === 'sale' && payMethod === 'cash' && Number(cashReceived) < total) {
      setNotice('❌ รับเงินไม่พอ'); return;
    }
    setSubmitting(true); setNotice(null);

    // บันทึก stock movements + ตัดสต๊อก lot
    for (const item of cart) {
      if (item.type === 'seed' && item.lot_id) {
        // ตัดสต๊อกจาก seed_stock_lots โดยตรง
        await fetch('/api/admin/stock-movements', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movement_type: mode === 'sale' ? 'sale' : 'reservation',
            warehouse_id:  selWH,
            variety_id:    item.variety_id ?? null,
            product_name:  item.name,
            unit: item.unit, qty: item.qty,
            unit_price: item.unit_price,
            ref_type: mode === 'sale' ? 'pos_sale' : 'pos_reserve',
            note: `LOT: ${item.lot_no ?? ''} | สมาชิก: ${member.full_name}`,
          }),
        });
      } else {
        await fetch('/api/admin/stock-movements', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movement_type: mode === 'sale' ? 'sale' : 'reservation',
            warehouse_id:  selWH,
            product_id:    item.product_id ?? null,
            product_name:  item.name,
            unit: item.unit, qty: item.qty,
            unit_price: item.unit_price,
            ref_type: mode === 'sale' ? 'pos_sale' : 'pos_reserve',
            note: `สมาชิก: ${member.full_name}`,
          }),
        });
      }
    }

    // สร้าง sale order
    const orderRes = await fetch('/api/admin/sale-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:      member.id,
        order_type:     mode,
        warehouse_id:   selWH,
        items:          cart.map((c) => ({ product_id: c.product_id, variety_id: c.variety_id, qty: c.qty, unit_price: c.unit_price, product_name: c.name })),
        payment_method: payMethod,
        paid_amount:    payMethod === 'cash' ? Number(cashReceived) : total,
        discount:       discountAmt,
      }),
    });
    const d = (await orderRes.json()) as { ok?: boolean; order_number?: string; error?: string };
    setSubmitting(false);
    if (!orderRes.ok) { setNotice(`❌ ${d.error}`); return; }

    setReceipt({ order_no: d.order_number ?? '', total, change });
    setCart([]); setCashReceived(''); setDiscount('0');
  }

  // Receipt screen
  if (receipt) return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>🧾</div>
      <h2 style={{ margin: '8px 0 4px', color: '#1b5e20' }}>ทำรายการสำเร็จ</h2>
      <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 18, fontWeight: 700 }}>{receipt.order_no}</p>
      <div style={{ background: '#e8f5e9', borderRadius: 14, padding: 16, margin: '16px 0', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>ยอดรวม</span><span style={{ fontWeight: 800 }}>{receipt.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
        </div>
        {payMethod === 'cash' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>รับเงิน</span><span>{Number(cashReceived).toLocaleString()} บาท</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, color: '#1b5e20', borderTop: '1px solid #a5d6a7', paddingTop: 8 }}>
              <span>เงินทอน</span><span>{receipt.change.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
            </div>
          </>
        )}
      </div>
      <button onClick={() => setReceipt(null)}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        ✅ ทำรายการใหม่
      </button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, height: 'calc(100vh - 120px)', minHeight: 600 }}>

      {/* ── Left: Product Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {/* toolbar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* warehouse */}
          <select value={selWH} onChange={(e) => setSelWH(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontWeight: 700, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
          </select>
          {/* mode */}
          {(['sale','reserve'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: mode === m ? (m === 'sale' ? '#1b5e20' : '#1565c0') : '#f0f4f0', color: mode === m ? '#fff' : 'inherit' }}>
              {m === 'sale' ? '💰 ขาย' : '📋 จอง'}
            </button>
          ))}
          {/* search */}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาสินค้า…"
            style={{ flex: 1, minWidth: 160, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 14 }} />
        </div>

        {/* category chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: catFilter === cat ? 'var(--primary)' : '#e0e0e0', background: catFilter === cat ? 'var(--primary)' : '#fff', color: catFilter === cat ? '#fff' : 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* product grid */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, alignContent: 'start' }}>
          {loading && <p style={{ color: '#9ca3af', gridColumn: '1/-1' }}>กำลังโหลด…</p>}
          {!loading && filtered.length === 0 && <p style={{ color: '#9ca3af', gridColumn: '1/-1' }}>ไม่พบสินค้า</p>}
          {filtered.map((s) => {
            const key    = s.type === 'seed' ? `s-${s.lot_id}` : `p-${s.product_id}`;
            const inCart = cart.find((c) => c.key === key);
            return (
              <button key={s.id} onClick={() => addItem(s)} disabled={s.qty_available <= 0}
                style={{ padding: '12px 10px', borderRadius: 14, border: `2px solid ${inCart ? 'var(--primary)' : '#e4ebe4'}`, background: inCart ? '#e8f5e9' : s.qty_available <= 0 ? '#f5f5f5' : '#fff', cursor: s.qty_available <= 0 ? 'not-allowed' : 'pointer', textAlign: 'left', position: 'relative', opacity: s.qty_available <= 0 ? 0.5 : 1 }}>
                {inCart && <span style={{ position: 'absolute', top: 6, right: 8, background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{inCart.qty}</span>}
                {s.image_url
                  ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />
                  : <div style={{ width: '100%', height: 40, background: '#e8f5e9', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌾</div>
                }
                <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>{s.name}</p>
                {s.lot_no && <p style={{ margin: '0 0 2px', fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{s.lot_no}</p>}
                {s.supplier && <p style={{ margin: '0 0 2px', fontSize: 11, color: '#6b7280' }}>{s.supplier}</p>}
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#c62828' }}>{(s.unit_price ?? 0).toLocaleString()} ฿</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: s.qty_available <= 5 ? '#c62828' : '#9ca3af' }}>
                  {s.unit} · เหลือ {s.qty_available.toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Cart Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f7faf7', borderRadius: 16, padding: 16, border: '1.5px solid #e4ebe4', overflow: 'hidden' }}>
        {/* member */}
        <MemberSearch onSelect={setMember} />
        {member && (
          <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{member.full_name}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#4a6741' }}>{member.phone ?? ''}</p>
            </div>
            <button onClick={() => setMember(null)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
        )}

        {/* cart items */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cart.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 24 }}>กดสินค้าเพื่อเพิ่มลงตะกร้า</p>}
          {cart.map((item) => (
            <div key={item.key} style={{ background: '#fff', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{item.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{item.unit_price.toLocaleString()} ×</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => updateQty(item.key, item.qty - 1)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e0e0e0', background: '#f5f5f5', cursor: 'pointer', fontWeight: 700 }}>−</button>
                <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.key, item.qty + 1)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--primary)', background: '#e8f5e9', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}>+</button>
              </div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 14, minWidth: 70, textAlign: 'right', color: '#1b5e20' }}>{(item.qty * item.unit_price).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* notice */}
        {notice && <div style={{ background: '#ffebee', borderRadius: 8, padding: '8px 12px', color: '#c62828', fontWeight: 600, fontSize: 13 }}>{notice}</div>}

        {/* payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #e4ebe4', paddingTop: 10 }}>
          {/* discount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>ส่วนลด (บาท)</span>
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" min="0"
              style={{ width: 80, textAlign: 'right', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 14 }} />
          </div>

          {/* subtotal/total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
            <span>ยอดรวม</span><span>{subtotal.toLocaleString()} บาท</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#c62828' }}>
              <span>หักส่วนลด</span><span>−{discountAmt.toLocaleString()} บาท</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, color: '#1b5e20' }}>
            <span>ชำระ</span><span>{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>

          {/* payment method */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['cash','transfer','credit'] as const).map((m) => (
              <button key={m} onClick={() => setPayMethod(m)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: payMethod === m ? '#1b5e20' : '#e8f5e9', color: payMethod === m ? '#fff' : '#1b5e20' }}>
                {m === 'cash' ? '💵 สด' : m === 'transfer' ? '🏦 โอน' : '📒 เครดิต'}
              </button>
            ))}
          </div>

          {/* cash received + change */}
          {payMethod === 'cash' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>รับเงิน</p>
                  <input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} type="number"
                    placeholder={total.toString()}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 16, fontWeight: 700 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>เงินทอน</p>
                  <div style={{ padding: '8px 10px', borderRadius: 8, background: '#e8f5e9', fontSize: 16, fontWeight: 900, color: '#1b5e20', minHeight: 38, display: 'flex', alignItems: 'center' }}>
                    {change.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              {/* quick cash buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((v) => (
                  <button key={v} onClick={() => setCashReceived(v.toString())}
                    style={{ flex: 1, padding: '4px 2px', borderRadius: 6, border: '1px solid #a5d6a7', background: '#f0faf0', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* submit */}
          <button onClick={submit} disabled={submitting || cart.length === 0 || !member}
            style={{ padding: '14px', borderRadius: 14, border: 'none', background: submitting || cart.length === 0 || !member ? '#9ca3af' : (mode === 'sale' ? '#1b5e20' : '#1565c0'), color: '#fff', fontWeight: 800, fontSize: 16, cursor: submitting || cart.length === 0 || !member ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'กำลังบันทึก…' : mode === 'sale' ? `💰 ขาย ${cart.reduce((s,c)=>s+c.qty,0)} รายการ` : `📋 จอง ${cart.reduce((s,c)=>s+c.qty,0)} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
}
