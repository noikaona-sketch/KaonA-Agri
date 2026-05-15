'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';
import { SeedVarietyCard } from '@/features/member-seed-varieties/seed-variety-card';
import type { SeedVarietyDetail } from '@/features/member-seed-varieties/seed-variety-card';

// ── Types ────────────────────────────────────────────────────────────
type Supplier = { id: string; supplier_name: string };
type Lot = {
  id: string; lot_no: string; variety_name: string; variety_id: string;
  quantity_balance: number; bag_weight_kg: number; price_per_bag: number;
  status: string; crop_type: string; supplier_id: string;
};
type CartItem = { lot: Lot; qty: number };
type Reservation = {
  id: string; reservation_no: string; status: string;
  variety_name: string; lot_no: string; supplier_name: string | null;
  qty_reserved: number; price_per_bag: number; total_amount: number | null;
  pickup_date: string | null; note: string | null; created_at: string;
  seed_stock_lots: { bag_weight_kg: number }[] | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string; desc: string }> = {
  pending:   { icon: '⏳', label: 'รอยืนยัน',     color: '#e65100', bg: '#fff8e1', desc: 'รอ admin ยืนยันการจอง' },
  confirmed: { icon: '✅', label: 'ยืนยันแล้ว',   color: '#1565c0', bg: '#e3f2fd', desc: 'จองสำเร็จ รอมารับสินค้า' },
  completed: { icon: '💰', label: 'รับสินค้าแล้ว', color: '#2e7d32', bg: '#e8f5e9', desc: 'รับสินค้าและชำระแล้ว' },
  cancelled: { icon: '❌', label: 'ยกเลิก',        color: '#c62828', bg: '#ffebee', desc: 'การจองถูกยกเลิก' },
};

type Screen = 'history' | 'shop' | 'detail' | 'cart' | 'checkout' | 'success';

export function SeedReservationFlow() {
  const member = useCurrentMember();

  // data
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [lots, setLots]             = useState<Lot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lotsLoading, setLotsLoading] = useState(false);

  // navigation
  const [screen, setScreen]         = useState<Screen>('history');
  const [selSupplier, setSelSupplier] = useState<Supplier | null>(null);
  const [detailLot, setDetailLot]   = useState<Lot | null>(null);
  const [detailVariety, setDetailVariety] = useState<SeedVarietyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // cart
  const [cart, setCart]             = useState<CartItem[]>([]);

  // checkout
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ reservation_no: string; total_amount: number }[]>([]);

  // filter
  const [filter, setFilter]         = useState<'all' | 'active' | 'done'>('all');
  const [searchText, setSearchText] = useState('');

  // ── load ─────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const [supRes] = await Promise.all([
      s.from('seed_suppliers').select('id,supplier_name').eq('active_status', 'active').order('supplier_name'),
    ]);
    setSuppliers((supRes.data as Supplier[]) ?? []);

    if (member?.member_id) {
      const res = await fetch(`/api/member/seed-reservation?member_id=${member.member_id}`);
      const d = (await res.json()) as { reservations: Reservation[] };
      setReservations(d.reservations ?? []);
    }
    setLoading(false);
  }

  async function loadLots(supplierId: string) {
    setLotsLoading(true);
    const s = createSupabaseBrowserClient();
    const { data } = await s
      .from('seed_stock_lots')
      .select('id,lot_no,variety_name,variety_id,quantity_balance,bag_weight_kg,price_per_bag,status,supplier_id,seed_varieties(crop_type)')
      .eq('supplier_id', supplierId)
      .in('status', ['available', 'low'])
      .gt('quantity_balance', 0)
      .order('variety_name');
    setLots((data ?? []).map((l: Record<string, unknown>) => ({
      ...l,
      crop_type: (l.seed_varieties as { crop_type: string }[] | null)?.[0]?.crop_type ?? 'ข้าวโพด',
    })) as Lot[]);
    setLotsLoading(false);
  }

  async function loadDetail(lot: Lot) {
    setDetailLot(lot);
    setDetailLoading(true);
    const s = createSupabaseBrowserClient();
    const { data } = await s
      .from('seed_varieties')
      .select('*,seed_suppliers(supplier_name)')
      .eq('id', lot.variety_id)
      .single();
    setDetailVariety(data as SeedVarietyDetail | null);
    setDetailLoading(false);
    setScreen('detail');
  }

  useEffect(() => { void loadData(); }, [member?.member_id]);

  // ── cart helpers ─────────────────────────────────────────────────
  function addToCart(lot: Lot, qty: number) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.lot.id === lot.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: Math.min(lot.quantity_balance, updated[idx].qty + qty) };
        return updated;
      }
      return [...prev, { lot, qty: Math.min(lot.quantity_balance, qty) }];
    });
  }

  function updateCartQty(lotId: string, qty: number) {
    setCart((prev) => qty <= 0
      ? prev.filter((c) => c.lot.id !== lotId)
      : prev.map((c) => c.lot.id === lotId ? { ...c, qty: Math.min(c.lot.quantity_balance, qty) } : c)
    );
  }

  const cartTotal   = cart.reduce((s, c) => s + c.qty * c.lot.price_per_bag, 0);
  const cartItems   = cart.reduce((s, c) => s + c.qty, 0);
  const cartWeightKg = cart.reduce((s, c) => s + c.qty * c.lot.bag_weight_kg, 0);

  // ── checkout ─────────────────────────────────────────────────────
  async function submit() {
    if (!member?.member_id || cart.length === 0) return;
    setSaving(true); setError(null);
    const results = [];
    for (const item of cart) {
      const res = await fetch('/api/member/seed-reservation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id, lot_id: item.lot.id,
          qty_reserved: item.qty, pickup_date: pickupDate || null, note: note || null,
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string; reservation_no?: string; total_amount?: number };
      if (!res.ok) { setError(d.error ?? 'จองไม่สำเร็จ'); setSaving(false); return; }
      results.push({ reservation_no: d.reservation_no ?? '', total_amount: d.total_amount ?? 0 });
    }
    setSaving(false);
    setSuccessData(results);
    setCart([]);
    setScreen('success');
    await loadData();
  }

  // ── Screens ───────────────────────────────────────────────────────

  // SUCCESS
  if (screen === 'success') return (
    <div className="mobile-stack" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 72 }}>🎉</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1b5e20' }}>จองสำเร็จ!</h2>
      {successData.map((d) => (
        <div key={d.reservation_no} className="kaona-card" style={{ textAlign: 'left', background: '#e8f5e9' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#4a6741' }}>หมายเลขการจอง</p>
          <p style={{ margin: '4px 0', fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#1b5e20' }}>{d.reservation_no}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>ยอด {d.total_amount.toLocaleString()} บาท — ชำระเมื่อรับสินค้า</p>
        </div>
      ))}
      <div className="kaona-card" style={{ background: '#fff8e1', textAlign: 'left' }}>
        <p style={{ margin: 0, fontSize: 14, color: '#e65100', lineHeight: 1.8 }}>
          ⏳ รอ admin ยืนยัน<br />
          📱 แจ้งเตือนเมื่อพร้อมรับ<br />
          💰 ชำระเมื่อมารับที่จุดจ่ายยา
        </p>
      </div>
      <UIButton fullWidth onClick={() => { setScreen('history'); setSuccessData([]); }}>← ดูประวัติการจอง</UIButton>
    </div>
  );

  // CHECKOUT
  if (screen === 'checkout') return (
    <div className="mobile-stack">
      <button onClick={() => setScreen('cart')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับตะกร้า</button>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📋 สรุปการจอง</p>

      {cart.map((item) => (
        <div key={item.lot.id} className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{item.lot.variety_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>LOT: {item.lot.lot_no} · {item.lot.bag_weight_kg} กก./ถุง</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--primary)' }}>{(item.qty * item.lot.price_per_bag).toLocaleString()} บาท</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{item.qty} ถุง × {item.lot.price_per_bag.toLocaleString()}</p>
            </div>
          </div>
        </div>
      ))}

      <div style={{ background: '#1b5e20', borderRadius: 16, padding: '16px 18px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ opacity: 0.8 }}>น้ำหนักรวม</span><span style={{ fontWeight: 700 }}>{cartWeightKg.toLocaleString()} กก.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>ยอดรวมทั้งหมด</span>
          <span style={{ fontSize: 22, fontWeight: 900 }}>{cartTotal.toLocaleString()} บาท</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.8 }}>💰 ชำระเมื่อมารับสินค้า — ไม่ต้องจ่ายตอนจอง</p>
      </div>

      {error && <div style={{ background: '#ffebee', borderRadius: 12, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

      <label className="reg-label">วันที่ต้องการรับสินค้า
        <input className="reg-input" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="reg-label">หมายเหตุ
        <textarea className="reg-input reg-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ข้อมูลเพิ่มเติม..." />
      </label>

      <UIButton fullWidth onClick={submit} loading={saving} disabled={saving}>
        ✅ ยืนยันจอง {cartItems} รายการ
      </UIButton>
    </div>
  );

  // CART
  if (screen === 'cart') return (
    <div className="mobile-stack">
      <button onClick={() => setScreen('shop')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← เลือกสินค้าเพิ่ม</button>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🛒 ตะกร้าสินค้า ({cartItems} รายการ)</p>

      {cart.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>🛒</div>
          <p>ตะกร้าว่าง</p>
        </div>
      )}

      {cart.map((item) => (
        <div key={item.lot.id} className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>🌾 {item.lot.variety_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>LOT: {item.lot.lot_no}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--primary)', fontWeight: 700 }}>{item.lot.price_per_bag.toLocaleString()} บาท/ถุง</p>
            </div>
            <button onClick={() => updateCartQty(item.lot.id, 0)}
              style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => updateCartQty(item.lot.id, item.qty - 1)}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid #e0e0e0', background: '#f5f5f5', fontSize: 18, cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{item.qty}</span>
              <button onClick={() => updateCartQty(item.lot.id, item.qty + 1)}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--primary)', background: '#e8f5e9', fontSize: 18, cursor: 'pointer', color: 'var(--primary)' }}>+</button>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>ถุง (เหลือ {item.lot.quantity_balance})</span>
            </div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#1b5e20' }}>{(item.qty * item.lot.price_per_bag).toLocaleString()} ฿</p>
          </div>
        </div>
      ))}

      {cart.length > 0 && (
        <>
          <div style={{ background: '#f7faf7', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>น้ำหนักรวม</span>
              <span style={{ fontWeight: 700 }}>{cartWeightKg.toLocaleString()} กก.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>ยอดรวม</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#1b5e20' }}>{cartTotal.toLocaleString()} บาท</span>
            </div>
          </div>
          <UIButton fullWidth onClick={() => setScreen('checkout')}>
            🛒 สรุปการจอง ({cartItems} รายการ)
          </UIButton>
        </>
      )}
    </div>
  );

  // DETAIL
  if (screen === 'detail' && detailLot) {
    const cartQty = cart.find((c) => c.lot.id === detailLot.id)?.qty ?? 0;
    return (
      <div className="mobile-stack">
        <button onClick={() => setScreen('shop')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับ</button>
        {detailLoading && <LoadingState label="กำลังโหลด…" />}
        {!detailLoading && detailVariety && (
          <SeedVarietyCard variety={detailVariety} />
        )}
        {/* stock info */}
        <div className="kaona-card">
          <p style={{ margin: '0 0 10px', fontWeight: 700 }}>📦 ข้อมูลสต๊อก</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'LOT', value: detailLot.lot_no },
              { label: 'คงเหลือ', value: `${detailLot.quantity_balance} ถุง` },
              { label: 'น้ำหนัก/ถุง', value: `${detailLot.bag_weight_kg} กก.` },
              { label: 'ราคา/ถุง', value: `${detailLot.price_per_bag.toLocaleString()} บาท` },
            ].map((s) => (
              <div key={s.label} style={{ background: '#f7faf7', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
                <p style={{ margin: '2px 0 0', fontWeight: 700 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* add to cart */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {cartQty > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f4f0', borderRadius: 10, padding: '4px 8px' }}>
              <button onClick={() => updateCartQty(detailLot.id, cartQty - 1)}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', fontSize: 16, cursor: 'pointer' }}>−</button>
              <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{cartQty}</span>
              <button onClick={() => updateCartQty(detailLot.id, cartQty + 1)}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--primary)', background: '#e8f5e9', fontSize: 16, cursor: 'pointer', color: 'var(--primary)' }}>+</button>
            </div>
          )}
          <UIButton fullWidth onClick={() => { addToCart(detailLot, 1); }}>
            🛒 {cartQty > 0 ? `เพิ่มอีก 1 ถุง (มี ${cartQty} ถุงในตะกร้า)` : 'เพิ่มในตะกร้า'}
          </UIButton>
        </div>
        {cartQty > 0 && (
          <UIButton fullWidth variant="secondary" onClick={() => setScreen('cart')}>
            ดูตะกร้า ({cartItems} รายการ · {cartTotal.toLocaleString()} บาท) →
          </UIButton>
        )}
      </div>
    );
  }

  // SHOP
  if (screen === 'shop') {
    const filtered = lots.filter((l) =>
      !searchText || l.variety_name.toLowerCase().includes(searchText.toLowerCase()) || l.crop_type.includes(searchText)
    );
    const grouped = filtered.reduce<Record<string, Lot[]>>((acc, l) => {
      if (!acc[l.crop_type]) acc[l.crop_type] = [];
      acc[l.crop_type].push(l);
      return acc;
    }, {});

    return (
      <div className="mobile-stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setScreen('history')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0, flexShrink: 0 }}>← กลับ</button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>{selSupplier?.supplier_name}</p>
          {cartItems > 0 && (
            <button onClick={() => setScreen('cart')}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
              🛒 {cartItems} · {cartTotal.toLocaleString()} ฿
            </button>
          )}
        </div>

        <input className="reg-input" placeholder="🔍 ค้นหาพันธุ์…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />

        {lotsLoading && <LoadingState label="กำลังโหลด…" />}
        {!lotsLoading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}><div style={{ fontSize: 48 }}>📦</div><p>ไม่มีสินค้าในสต๊อก</p></div>
        )}

        {Object.entries(grouped).map(([cropType, cropLots]) => (
          <div key={cropType}>
            <p style={{ margin: '4px 0 8px', fontWeight: 800, fontSize: 14, color: '#4a6741' }}>🌽 {cropType}</p>
            {cropLots.map((lot) => {
              const inCart = cart.find((c) => c.lot.id === lot.id)?.qty ?? 0;
              return (
                <div key={lot.id} className="kaona-card" style={{ padding: '14px 16px' }}>
                  {/* product row */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* icon */}
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🌾</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{lot.variety_name}</p>
                      <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>LOT: {lot.lot_no} · {lot.bag_weight_kg} กก./ถุง</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#c62828' }}>{lot.price_per_bag.toLocaleString()} บาท</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>เหลือ {lot.quantity_balance} ถุง</span>
                        {lot.status === 'low' && <span style={{ fontSize: 10, background: '#ffebee', color: '#c62828', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>ใกล้หมด</span>}
                      </div>
                    </div>
                  </div>

                  {/* buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => loadDetail(lot)}
                      style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #a5d6a7', background: '#f7faf7', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#2e7d32' }}>
                      📋 รายละเอียด
                    </button>
                    {inCart > 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, background: '#e8f5e9', borderRadius: 10, padding: '4px 8px', justifyContent: 'space-between' }}>
                        <button onClick={() => updateCartQty(lot.id, inCart - 1)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #a5d6a7', background: '#fff', fontSize: 16, cursor: 'pointer' }}>−</button>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>{inCart}</span>
                        <button onClick={() => updateCartQty(lot.id, inCart + 1)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--primary)', fontSize: 16, cursor: 'pointer', color: '#fff' }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(lot, 1)}
                        style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', background: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                        🛒 เพิ่มลงตะกร้า
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* floating cart button */}
        {cartItems > 0 && (
          <div style={{ position: 'sticky', bottom: 0, background: '#fff', padding: '12px 0 4px', marginTop: 8 }}>
            <UIButton fullWidth onClick={() => setScreen('cart')}>
              🛒 ดูตะกร้า ({cartItems} รายการ) · {cartTotal.toLocaleString()} บาท →
            </UIButton>
          </div>
        )}
      </div>
    );
  }

  // HISTORY (default)
  if (loading) return <LoadingState label="กำลังโหลด…" />;
  const activeCount = reservations.filter((r) => ['pending','confirmed'].includes(r.status)).length;
  const filteredRes = reservations.filter((r) => {
    if (filter === 'active') return ['pending','confirmed'].includes(r.status);
    if (filter === 'done')   return ['completed','cancelled'].includes(r.status);
    return true;
  });

  return (
    <div className="mobile-stack">
      {/* supplier buttons */}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#4a6741' }}>🏪 เลือก Supplier เพื่อจอง</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {suppliers.map((s) => (
          <button key={s.id}
            onClick={async () => { setSelSupplier(s); setSearchText(''); setScreen('shop'); await loadLots(s.id); }}
            style={{ padding: '10px 18px', borderRadius: 24, border: '1.5px solid var(--primary)', background: '#e8f5e9', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🏪 {s.supplier_name}
          </button>
        ))}
      </div>

      {/* filter */}
      <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>📋 ประวัติการจอง</p>
      <div style={{ display: 'flex', gap: 6 }}>
        {([
          { key: 'all',    label: `ทั้งหมด (${reservations.length})` },
          { key: 'active', label: `⏳ รอ (${activeCount})` },
          { key: 'done',   label: '✅ เสร็จ' },
        ] as const).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: filter === f.key ? 'var(--primary)' : '#f0f4f0', color: filter === f.key ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {f.label}
          </button>
        ))}
      </div>

      {filteredRes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>🌾</div>
          <p style={{ margin: '8px 0 0' }}>ยังไม่มีการจอง</p>
        </div>
      )}

      {filteredRes.map((r) => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
        const bagWeight = r.seed_stock_lots?.[0]?.bag_weight_kg ?? 1;
        return (
          <div key={r.id} className="kaona-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🌾 {r.variety_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.reservation_no}</p>
              </div>
              <span style={{ background: st.bg, border: `1px solid ${st.color}44`, borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 800, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {st.icon} {st.label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'จำนวน',     value: `${r.qty_reserved} ถุง` },
                { label: 'น้ำหนัก',   value: `${(r.qty_reserved * bagWeight).toLocaleString()} กก.` },
                { label: 'ยอดรวม',    value: `${(r.total_amount ?? 0).toLocaleString()} บาท` },
              ].map((s) => (
                <div key={s.label} style={{ background: '#f7faf7', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700 }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ background: st.bg, borderRadius: 10, padding: '6px 12px', marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 12, color: st.color }}>{st.desc}</p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              🏪 {r.supplier_name ?? '—'} · LOT: {r.lot_no}
              {r.pickup_date ? ` · 📅 ${new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
