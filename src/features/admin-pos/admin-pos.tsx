'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PosCartPanel }  from './pos-cart-panel';
import { PosReceipt }    from './pos-receipt';
import { CreateMemberDrawer } from '@/features/admin-members/create-member-drawer';

// ── Types ─────────────────────────────────────────────────────────────
type Warehouse = { id: string; code: string; name: string };
export type CartItem = {
  key: string; type: 'product'; product_id?: string;
  name: string; category: string; unit: string;
  unit_price: number; qty: number;
  isReservedSeed?: boolean;
};
type PosItem = {
  id: string; type: 'product'; product_id?: string;
  name: string; category: string; supplier: string; image_url: string | null;
  unit: string; unit_price: number; qty_available: number; status: string;
};
type Member  = { id: string; full_name: string; member_number?: string; phone?: string | null; citizen_id_masked?: string | null };
type Session = { id: string; session_no: string; opening_cash: number; status: string };
type Slot    = { id: string; pickup_date: string; pickup_time: string; status: string; pickup_locations: { name: string; address: string | null } | null };
type MemberReservation = { id: string; reservation_no: string; product_id: string | null; qty_reserved: number; variety_name: string; price_per_bag: number };

// ── MemberSearch ───────────────────────────────────────────────────────
function MemberSearch({ onSelect, selected, refreshKey }: { onSelect: (m: Member | null) => void; selected: Member | null; refreshKey: number }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]     = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!q) return;
    void (async () => {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=10&status=approved`);
      const d = (await res.json()) as { members?: Member[] };
      setResults(d.members ?? []);
    })();
  }, [refreshKey]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&limit=10&status=approved`);
      const d = (await res.json()) as { members?: Member[] };
      setResults(d.members ?? []); setOpen(true); setLoading(false);
    }, 200);
  }, [q]);

  function pick(m: Member) { onSelect(m); setQ(''); setResults([]); setOpen(false); }
  function clear()         { onSelect(null); setQ(''); }

  if (selected) return (
    <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid #a5d6a7' }}>
      <div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>👤 {selected.full_name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4a6741' }}>{selected.phone ?? ''}{selected.citizen_id_masked ? ` · ${selected.citizen_id_masked}` : ''}</p>
      </div>
      <button onClick={clear} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 20 }}>✕</button>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${open ? 'var(--primary)' : '#e0e0e0'}`, borderRadius: 10, padding: '8px 12px', background: '#fff' }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อ / หมายเลขบัตร / เบอร์…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }}
            onFocus={() => q.length >= 1 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
          {loading && <span style={{ fontSize: 12, color: '#9ca3af' }}>⏳</span>}
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>}
        </div>
        <button onClick={() => setScanMode(!scanMode)} title="สแกน QR"
          style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${scanMode ? 'var(--primary)' : '#e0e0e0'}`, background: scanMode ? '#e8f5e9' : '#fff', cursor: 'pointer', fontSize: 20, color: scanMode ? 'var(--primary)' : '#666' }}>
          📷
        </button>
      </div>
      {scanMode && (
        <div style={{ marginTop: 6, background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#2e7d32' }}>
          <input autoFocus onChange={(e) => { setQ(e.target.value.trim()); e.target.value = ''; setScanMode(false); }}
            placeholder="วางหน้ากล้องหรือเสียบ barcode reader…"
            style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #a5d6a7', fontSize: 14 }} />
        </div>
      )}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--primary)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
          {results.length === 0 && !loading && <p style={{ padding: '14px 16px', margin: 0, color: '#9ca3af', fontSize: 13 }}>ไม่พบสมาชิก</p>}
          {results.map((m) => (
            <button key={m.id} onMouseDown={() => pick(m)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f0f4f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{m.full_name}</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, color: '#6b7280' }}>{m.phone ?? ''}{m.citizen_id_masked ? ` · 🪪 ${m.citizen_id_masked}` : ''}</p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--primary)' }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main POS ──────────────────────────────────────────────────────────
export function AdminPos() {
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([]);
  const [selWH,        setSelWH]        = useState('');
  const [items,        setItems]        = useState<PosItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('ทั้งหมด');
  const [member,       setMember]       = useState<Member | null>(null);
  const [memberReservations, setMemberReservations] = useState<MemberReservation[]>([]);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [mode,         setMode]         = useState<'sale' | 'reservation'>('sale');
  const [payMethod,    setPayMethod]    = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discount,     setDiscount]     = useState('0');
  const [notice,       setNotice]       = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [receipt, setReceipt] = useState<{
    order_no: string; total: number; change: number; items: CartItem[];
    memberName: string; memberPhone: string | null;
    discount: number;
    resNote: string | null; resChannel: string | null;
    reservationNo: string | null; reservationStatus: string | null;
    qtyReserved: number | null; qtySold: number | null;
    pickupDate: string | null;
  } | null>(null);
  const [session,      setSession]      = useState<Session | null>(null);
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [selSlot,      setSelSlot]      = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [resNote,       setResNote]       = useState('');
  const [resChannel,    setResChannel]    = useState('หน้าร้าน');
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberRefreshKey, setMemberRefreshKey] = useState(0);

  // ── member select: auto-load reservations ──
  async function onMemberSelect(m: Member | null, options?: { preserveForm?: boolean }) {
    setMember(m);
    setMemberReservations([]);
    if (!options?.preserveForm) { setCart([]); setReservationId(null); setResNote(''); setResChannel('หน้าร้าน'); }
    if (!m) return;
    const res = await fetch(`/api/admin/seed-reservations?status=confirmed&member_id=${m.id}`);
    const payload = (await res.json()) as { items?: MemberReservation[] };
    setMemberReservations(payload.items ?? []);
  }

  async function loadReservationToCart(r: MemberReservation) {
    if (!r.product_id) { setNotice('❌ รายการจองนี้ยังไม่มี product_id'); return; }
    const existingReserved = cart.find((c) => c.isReservedSeed);
    if (existingReserved && existingReserved.product_id !== r.product_id) { setNotice('❌ มีเมล็ดพันธุ์จากการจองอยู่แล้ว'); return; }
    const item = items.find((i) => i.product_id === r.product_id);
    if (!item) { setNotice('❌ สินค้านี้ไม่มีในคลังที่เลือก'); return; }
    const key = `p-${r.product_id}`;
    setCart((prev) => {
      const exists = prev.find((c) => c.key === key);
      if (exists) return prev.map((c) => c.key === key ? { ...c, qty: r.qty_reserved, isReservedSeed: true } : c);
      return [...prev, { key, type: 'product' as const, product_id: item.product_id, name: item.name, category: item.category, unit: item.unit, unit_price: item.unit_price, qty: r.qty_reserved, isReservedSeed: true }];
    });
    setReservationId(r.id);
    setNotice(`✅ โหลดการจอง ${r.reservation_no} แล้ว`);
  }

  // ── data load ──
  useEffect(() => {
    void (async () => {
      const [whRes, sessRes, slotRes] = await Promise.all([
        fetch('/api/admin/warehouses', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/admin/cashier?status=open', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/admin/pickup-slots-all', { credentials: 'include' }).then((r) => r.json()),
      ]);
      const whs: Warehouse[] = (whRes as { warehouses?: Warehouse[] }).warehouses ?? [];
      setWarehouses(whs);
      if (whs[0]) setSelWH(whs[0].id);
      setSession(((sessRes as { sessions?: Session[] }).sessions ?? [])[0] ?? null);
      setSlots((slotRes as { slots?: Slot[] }).slots ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selWH) return;
    setLoading(true);
    void fetch(`/api/admin/pos-items?warehouse_id=${selWH}&mode=${mode}`)
      .then((r) => r.json())
      .then((d: { items?: PosItem[] }) => { setItems(d.items ?? []); setLoading(false); });
  }, [selWH, mode]);

  const addItem = useCallback((item: PosItem) => {
    const key = `p-${item.product_id}`;
    setCart((prev) => {
      const exists = prev.find((c) => c.key === key);
      if (exists) return prev.map((c) => c.key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { key, type: 'product' as const, name: item.name, category: item.category, unit: item.unit, unit_price: item.unit_price, qty: 1, product_id: item.product_id }];
    });
  }, []);

  const updateQty = (key: string, qty: number) =>
    setCart((prev) => {
      const item = prev.find((c) => c.key === key);
      if (item?.isReservedSeed) return prev;
      return qty <= 0 ? prev.filter((c) => c.key !== key) : prev.map((c) => c.key === key ? { ...c, qty } : c);
    });

  const subtotal    = cart.reduce((s, c) => s + c.qty * c.unit_price, 0);
  const discountAmt = Number(discount) || 0;
  const total       = Math.max(0, subtotal - discountAmt);
  const change      = payMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - total) : 0;
  const categories  = ['ทั้งหมด', ...new Set(items.map((s) => s.category))];
  const filtered    = items.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === 'ทั้งหมด' || s.category === catFilter;
    return matchSearch && matchCat;
  });

  async function submit() {
    if (!member) { setNotice('❌ กรุณาเลือกสมาชิก'); return; }
    if (cart.length === 0) { setNotice('❌ กรุณาเพิ่มสินค้า'); return; }
    if (mode === 'sale' && payMethod === 'cash' && Number(cashReceived) < total) { setNotice('❌ รับเงินไม่พอ'); return; }
    setSubmitting(true); setNotice(null);

    for (const item of cart) {
      const stockRes = await fetch('/api/admin/stock-movements', { credentials: 'include',
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movement_type: mode === 'sale' ? 'sale' : 'reservation', warehouse_id: selWH, product_id: item.product_id ?? null, product_name: item.name, unit: item.unit, qty: item.qty, unit_price: item.unit_price, ref_type: mode === 'sale' ? 'pos_sale' : 'pos_reserve', note: `สมาชิก: ${member.full_name}` }),
      });
      const stockData = (await stockRes.json()) as { error?: string };
      if (!stockRes.ok) {
        setSubmitting(false);
        setNotice(`❌ ${stockData.error ?? 'ไม่สามารถบันทึกการเคลื่อนไหวสต๊อกได้'}`);
        return;
      }
    }

    const orderRes = await fetch('/api/admin/sale-order', { credentials: 'include',
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, order_type: mode, warehouse_id: selWH, pickup_slot_id: mode === 'reservation' ? selSlot || null : null, items: cart.map((c) => ({ product_id: c.product_id ?? null, product_name: c.name, qty: c.qty, unit_price: c.unit_price, unit: c.unit })), payment_method: payMethod, source_type: reservationId ? 'reservation' : 'walk_in', reservation_id: reservationId, paid_amount: payMethod === 'cash' ? Number(cashReceived) : total, discount: discountAmt, note: resNote || null, source_channel: mode === 'reservation' ? resChannel : null }),
    });
    const d = (await orderRes.json()) as { ok?: boolean; order_number?: string; error?: string };
    setSubmitting(false);
    if (!orderRes.ok) { setNotice(`❌ ${d.error}`); return; }

    const savedCart   = [...cart];
    const savedMember = member;
    const reservedItem = savedCart.find((c) => c.isReservedSeed);
    const qtySold      = reservedItem?.qty ?? null;
    const resInfo      = memberReservations.find((r) => r.id === reservationId);
    const qtyReserved  = resInfo?.qty_reserved ?? null;
    const resNo        = resInfo?.reservation_no ?? null;
    const resStatus    = qtyReserved != null && qtySold != null
      ? (qtySold >= qtyReserved ? 'ครบ' : 'ค้าง')
      : null;

    const selSlotData  = slots.find((s) => s.id === selSlot);
    const pickupDate   = selSlotData
      ? `${new Date(selSlotData.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} ${selSlotData.pickup_time}`
      : null;

    setReceipt({
      order_no: d.order_number ?? '', total, change, items: savedCart,
      memberName: savedMember?.full_name ?? '',
      memberPhone: savedMember?.phone ?? null,
      discount: discountAmt,
      resNote: resNote || null,
      resChannel: resChannel || null,
      reservationNo: resNo,
      reservationStatus: resStatus,
      qtyReserved, qtySold,
      pickupDate,
    });
    setCart([]); setCashReceived(''); setDiscount('0'); setReservationId(null); setMemberReservations([]); setResNote(''); setResChannel('หน้าร้าน');
  }

  if (receipt) return (
    <PosReceipt
      receipt={receipt} mode={mode}
      memberName={receipt.memberName} memberPhone={receipt.memberPhone}
      items={receipt.items} payMethod={payMethod} cashReceived={cashReceived}
      discount={receipt.discount}
      resNote={receipt.resNote} resChannel={receipt.resChannel}
      reservationNo={receipt.reservationNo} reservationStatus={receipt.reservationStatus}
      qtyReserved={receipt.qtyReserved} qtySold={receipt.qtySold}
      pickupDate={receipt.pickupDate}
      onNew={() => setReceipt(null)} />
  );

  const modeColor = mode === 'sale' ? '#1b5e20' : '#1565c0';

  return (
    <div className="admin-pos-layout">
      {/* ── Main: products left, cart right ── */}
      <div className="admin-pos-grid">

        {/* Left: products */}
        <div className="admin-pos-left">
          {/* ── Top bar: mode + warehouse ── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            {/* mode toggle */}
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '2px solid #e0e0e0', flexShrink: 0 }}>
              {(['sale','reservation'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, background: mode === m ? (m === 'sale' ? '#1b5e20' : '#1565c0') : '#f5f5f5', color: mode === m ? '#fff' : '#666', transition: 'all 0.15s' }}>
                  {m === 'sale' ? '💰 ขาย' : '📋 จอง'}
                </button>
              ))}
            </div>
            <select value={selWH} onChange={(e) => setSelWH(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontWeight: 700, fontSize: 13, background: '#fff' }}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
            </select>
          </div>
          {/* member + product search ในแถวเดียวกัน */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <div style={{ flex: '0 0 340px' }}>
              <MemberSearch onSelect={onMemberSelect} selected={member} refreshKey={memberRefreshKey} />
              <button
                onClick={() => setMemberDrawerOpen(true)}
                className="admin-btn admin-btn--secondary"
                style={{ marginTop: 8, width: '100%' }}
              >
                ➕ เพิ่มสมาชิก
              </button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 ค้นหาสินค้า…"
              style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 14 }} />
          </div>

          {/* category chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: catFilter === cat ? modeColor : '#e0e0e0', background: catFilter === cat ? modeColor : '#fff', color: catFilter === cat ? '#fff' : 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {cat}
              </button>
            ))}
          </div>

          {/* product grid */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, alignContent: 'start' }}>
            {loading && <p style={{ color: '#9ca3af', gridColumn: '1/-1' }}>กำลังโหลด…</p>}
            {!loading && filtered.length === 0 && <p style={{ color: '#9ca3af', gridColumn: '1/-1' }}>ไม่พบสินค้า</p>}
            {filtered.map((s) => {
              const key             = `p-${s.product_id}`;
              const inCart          = cart.find((c) => c.key === key);
              const hasReservedSeed = cart.some((c) => c.isReservedSeed);
              const isSeedItem      = s.category === 'seed';
              const isLockedOut     = hasReservedSeed && isSeedItem && !inCart?.isReservedSeed;
              const isDisabled      = s.qty_available <= 0 || isLockedOut;
              return (
                <button key={s.id} onClick={() => !isDisabled && addItem(s)} disabled={isDisabled}
                  title={isLockedOut ? 'มีเมล็ดพันธุ์จองอยู่แล้ว' : undefined}
                  style={{ padding: '10px 8px', borderRadius: 12, border: `2px solid ${inCart ? modeColor : '#e4ebe4'}`, background: inCart ? (mode === 'sale' ? '#e8f5e9' : '#e3f2fd') : isDisabled ? '#f5f5f5' : '#fff', cursor: isDisabled ? 'not-allowed' : 'pointer', textAlign: 'left', position: 'relative', opacity: isDisabled ? 0.4 : 1 }}>
                  {inCart && <span style={{ position: 'absolute', top: 5, right: 6, background: modeColor, color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{inCart.qty}</span>}
                  {s.image_url
                    ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 6, marginBottom: 5 }} />
                    : <div style={{ width: '100%', height: 36, background: mode === 'sale' ? '#e8f5e9' : '#e3f2fd', borderRadius: 6, marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌾</div>
                  }
                  <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: modeColor }}>{(s.unit_price ?? 0).toLocaleString()} ฿</p>
                  <p style={{ margin: '1px 0 0', fontSize: 10, color: s.qty_available <= 5 ? '#c62828' : '#9ca3af' }}>เหลือ {s.qty_available.toLocaleString()}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: cart */}
        <aside className="admin-pos-right">
          <div className="admin-pos-right-sticky">
            <div className="admin-pos-cart-fill">
              <PosCartPanel
                mode={mode} cart={cart}
                memberReservations={memberReservations} reservationId={reservationId}
                slots={slots} selSlot={selSlot}
                discount={discount} payMethod={payMethod} cashReceived={cashReceived}
                submitting={submitting} notice={notice}
                subtotal={subtotal} total={total} change={change} discountAmt={discountAmt}
                resNote={resNote} resChannel={resChannel}
                onUpdateQty={updateQty}
                onLoadReservation={loadReservationToCart}
                onSelSlot={setSelSlot}
                onDiscount={setDiscount}
                onPayMethod={setPayMethod}
                onCashReceived={setCashReceived}
                onResNote={setResNote}
                onResChannel={setResChannel}
                onSubmit={submit}
              />
            </div>
          </div>
        </aside>
      </div>
      <CreateMemberDrawer
        open={memberDrawerOpen}
        onClose={() => setMemberDrawerOpen(false)}
        onCreated={(createdMember) => {
          setMemberRefreshKey((k) => k + 1);
          if (createdMember) {
            void onMemberSelect(createdMember, { preserveForm: true });
          }
        }}
      />
    </div>
  );
}
