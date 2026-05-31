'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

// ── Types ────────────────────────────────────────────────────────────
type Variety = {
  id: string; variety_name: string; supplier_name: string;
  price_per_bag: number; bag_weight_kg: number;
  crop_type: string; days_to_harvest: number | null;
  notes: string | null; planting_guide: string | null;
  image_url: string | null;
  product_id?: string;
};
type CartItem = { variety: Variety; qty: number };
type Plot = { id: string; name: string; province: string | null; area_rai: number };
type Slot = {
  id: string; pickup_date: string; pickup_time: string;
  capacity_qty: number; booked_qty: number; note: string | null;
  pickup_locations: { id: string; name: string; address: string | null; map_url: string | null } | null;
};
type Reservation = {
  id: string; reservation_no: string; status: string;
  variety_name: string; lot_no: string | null; supplier_name: string | null;
  qty_reserved: number; price_per_bag: number; total_amount: number | null;
  pickup_date: string | null; created_at: string;
  // nested relation — always array per SUPABASE_RULES
  products: { bag_weight_kg: number | null }[] | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  pending:   { icon: '⏳', label: 'รอยืนยัน',     color: '#e65100', bg: '#fff8e1' },
  confirmed: { icon: '✅', label: 'ยืนยันแล้ว',   color: '#1565c0', bg: '#e3f2fd' },
  completed: { icon: '🏁', label: 'รับสินค้าแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
  converted: { icon: '💰', label: 'รับสินค้าแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
  cancelled: { icon: '❌', label: 'ยกเลิก',        color: '#c62828', bg: '#ffebee' },
};

type Screen = 'shop' | 'history' | 'success';

export function SeedReservationFlow({ initialPlotId }: { initialPlotId?: string | null } = {}) {
  const member = useCurrentMember();

  // ── helper ดึง Supabase session token (refresh ถ้าหมดอายุ) ──
  async function getToken(): Promise<string> {
    try {
      const s = createSupabaseBrowserClient();
      // refreshSession ก่อน — ป้องกัน token หมดอายุ
      const { data: refreshed } = await s.auth.refreshSession();
      if (refreshed.session?.access_token) return refreshed.session.access_token;
      // fallback: ดึง session ปัจจุบัน
      const { data } = await s.auth.getSession();
      return data.session?.access_token ?? '';
    } catch { return ''; }
  }

  function authHeaders(token: string): Record<string,string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const [screen, setScreen]   = useState<Screen>('shop');
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots]     = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart]       = useState<CartItem[]>([]);
  const [selSlotId, setSelSlotId] = useState('');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [successNos, setSuccessNos] = useState<string[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [search, setSearch]   = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [plotName, setPlotName]     = useState<string | null>(null);

  // ── load plot name from initialPlotId ──────────────────────────────
  useEffect(() => {
    if (!initialPlotId) return;
    const sb = createSupabaseBrowserClient();
    void sb.from('plots').select('name').eq('id', initialPlotId).maybeSingle()
      .then(({ data }) => { if (data?.name) setPlotName(data.name); });
  }, [initialPlotId]);

  // ── load ─────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const token = await getToken();
    const headers = authHeaders(token);
    const [lotsRes, resRes, slotRes, plotRes] = await Promise.all([
      fetch('/api/member/seed-lots', { headers }).then((r) => r.json()) as Promise<{ lots: Record<string, unknown>[] }>,
      member?.member_id
        ? fetch(`/api/member/seed-reservation?member_id=${member.member_id}`, { headers }).then((r) => r.json()) as Promise<{ reservations: Reservation[] }>
        : Promise.resolve({ reservations: [] }),
      fetch('/api/member/pickup-slots', { headers }).then((r) => r.json()) as Promise<{ slots: Slot[] }>,
      member?.line_user_id && selectedPlotId
        ? fetch(`/api/member/plots?line_user_id=${encodeURIComponent(member.line_user_id)}`, { headers }).then((r) => r.json()) as Promise<{ plots?: Plot[] }>
        : Promise.resolve({ plots: [] }),
    ]);

    setVarieties((lotsRes.lots ?? []).map((l) => ({
      id:               l.id as string,
      variety_name:     l.variety_name as string,
      supplier_name:    (l.supplier_name as string) ?? '—',
      price_per_bag:    (l.price_per_bag as number) ?? 0,
      bag_weight_kg:    (l.bag_weight_kg as number) ?? 1,
      crop_type:        (l.crop_type as string) ?? '',
      days_to_harvest:  (l.days_to_harvest as number | null) ?? null,
      notes:            (l.notes as string | null) ?? null,
      planting_guide:   (l.planting_guide as string | null) ?? null,
      image_url:        (l.image_url as string | null) ?? null,
      product_id:       (l.product_id as string | undefined) ?? (l.id as string),
    })));
    setReservations(resRes.reservations ?? []);
    setSlots(slotRes.slots ?? []);
    setSelectedPlot((plotRes.plots ?? []).find((plot) => plot.id === selectedPlotId) ?? null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id, member?.line_user_id, selectedPlotId]);

  // ── cart ─────────────────────────────────────────────────────────
  function setQty(variety: Variety, qty: number) {
    const safe = Math.max(0, qty);
    setCart((prev) => {
      const exists = prev.find((c) => c.variety.id === variety.id);
      if (safe === 0) return prev.filter((c) => c.variety.id !== variety.id);
      if (exists) return prev.map((c) => c.variety.id === variety.id ? { ...c, qty: safe } : c);
      return [...prev, { variety, qty: safe }];
    });
  }
  function getQty(varietyId: string) { return cart.find((c) => c.variety.id === varietyId)?.qty ?? 0; }

  const totalBaht = cart.reduce((s, c) => s + c.qty * c.variety.price_per_bag, 0);
  const totalBags = cart.reduce((s, c) => s + c.qty, 0);
  const totalKg   = cart.reduce((s, c) => s + c.qty * c.variety.bag_weight_kg, 0);

  // ── submit ───────────────────────────────────────────────────────
  async function submit() {
    if (cart.length === 0 || !member?.member_id) return;
    setSaving(true); setError(null);
    const token = await getToken();
    const nos: string[] = [];
    const selSlot = slots.find((s) => s.id === selSlotId);
    for (const item of cart) {
      // product_id is required — no fallback to variety id
      if (!item.variety.product_id) {
        setError('เมล็ดพันธุ์นี้ยังไม่ได้สร้างเป็นสินค้าใน Product Master');
        setSaving(false); return;
      }
      const res = await fetch('/api/member/seed-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          member_id:     member.member_id,
          product_id:    item.variety.product_id,   // required — Product Master only
          variety_name:  item.variety.variety_name,
          supplier_name: item.variety.supplier_name,
          qty_reserved:  item.qty,
          price_per_bag: item.variety.price_per_bag,
          bag_weight_kg: item.variety.bag_weight_kg,
          pickup_date:   selSlot?.pickup_date ?? null,
          pickup_slot_id: selSlotId || null,
          note: note || null,
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string; reservation_no?: string };
      if (!res.ok) { setError(d.error ?? 'จองไม่สำเร็จ'); setSaving(false); return; }
      nos.push(d.reservation_no ?? '');
    }
    setSaving(false);
    setCart([]); setNote('');
    setSuccessNos(nos); setScreen('success');
    await load();
  }

  // ── filter ───────────────────────────────────────────────────────
  const suppliers = useMemo(() => [...new Set(varieties.map((v) => v.supplier_name))].sort(), [varieties]);
  const filtered  = useMemo(() => varieties.filter((v) => {
    const matchSup = !filterSupplier || v.supplier_name === filterSupplier;
    const matchSearch = !search || v.variety_name.toLowerCase().includes(search.toLowerCase());
    return matchSup && matchSearch;
  }), [varieties, filterSupplier, search]);

  // ── SUCCESS ───────────────────────────────────────────────────────
  if (screen === 'success') return (
    <div className="mobile-stack" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 72 }}>🎉</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1b5e20' }}>จองสำเร็จ!</h2>
      {successNos.map((no) => (
        <div key={no} style={{ background: '#e8f5e9', borderRadius: 14, padding: '14px 16px', textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#4a6741' }}>หมายเลขการจอง</p>
          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#1b5e20' }}>{no}</p>
        </div>
      ))}
      <div style={{ background: '#fff8e1', borderRadius: 14, padding: '14px 16px', textAlign: 'left', fontSize: 14, color: '#e65100', lineHeight: 1.8 }}>
        ⏳ รอ admin ยืนยัน<br/>
        📱 แจ้งเตือนเมื่อพร้อมรับ<br/>
        💰 ชำระเมื่อมารับสินค้า
      </div>
      <button onClick={() => setScreen('shop')}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        ← เลือกเมล็ดพันธุ์เพิ่ม
      </button>
      <button onClick={() => setScreen('history')}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: '1.5px solid var(--primary)', background: '#fff', color: 'var(--primary)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        📋 ดูประวัติการจอง
      </button>
    </div>
  );

  // ── HISTORY ───────────────────────────────────────────────────────
  if (screen === 'history') return (
    <div className="mobile-stack">
      <button onClick={() => setScreen('shop')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับ</button>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📋 ประวัติการจอง</p>
      {reservations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>🌾</div>
          <p>ยังไม่มีการจอง</p>
        </div>
      )}
      {reservations.map((r) => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
        const bw = r.products?.[0]?.bag_weight_kg ?? 1;
        return (
          <div key={r.id} className="kaona-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>🌾 {r.variety_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.reservation_no}</p>
              </div>
              <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}44`, borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {st.icon} {st.label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'จำนวน', value: `${r.qty_reserved} ถุง` },
                { label: 'น้ำหนัก', value: `${(r.qty_reserved * bw).toLocaleString()} กก.` },
                { label: 'ยอดรวม', value: `${(r.total_amount ?? 0).toLocaleString()} บาท` },
              ].map((s) => (
                <div key={s.label} style={{ background: '#f7faf7', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700 }}>{s.value}</p>
                </div>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
              🏪 {r.supplier_name ?? '—'}
              {r.lot_no && !['TBD', '-'].includes(r.lot_no) ? ` · LOT: ${r.lot_no}` : ''}
              {r.pickup_date ? ` · 📅 ${new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );

  // ── SHOP (main) ───────────────────────────────────────────────────
  if (loading) return <LoadingState label="กำลังโหลดเมล็ดพันธุ์…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: totalBags > 0 ? 140 : 0 }}>
      {selectedPlotId && (
        <div style={{ background: '#E6F1FB', border: '1px solid #185FA544', borderRadius: 14, padding: '12px 14px', color: '#0C447C', fontSize: 13, lineHeight: 1.6 }}>
          <strong>แปลงที่เลือก:</strong> {selectedPlot ? `${selectedPlot.name}${selectedPlot.province ? ` · ${selectedPlot.province}` : ''}` : 'ใช้แปลงที่เลือกจากหน้าแปลงของฉัน'}
        </div>
      )}

      {/* Plot context banner */}
      {plotName && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px', borderRadius: 10,
          background: '#e8f5e9', border: '1px solid #a5d6a7',
        }}>
          <span style={{ fontSize: 16 }}>🌾</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
            จองสำหรับแปลง: {plotName}
          </span>
        </div>
      )}

      {/* filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="reg-input" placeholder="🔍 ค้นหาพันธุ์…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 140 }} />
        <select className="reg-input" value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
          style={{ flex: 1, minWidth: 120 }}>
          <option value="">ทุก Supplier</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div style={{ background: '#ffebee', borderRadius: 12, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

      {/* variety list */}
      {filtered.map((v) => {
        const qty     = getQty(v.id);
        const expanded = expandedId === v.id;
        return (
          <div key={v.id} style={{ background: '#fff', borderRadius: 18, border: `1.5px solid ${qty > 0 ? '#a5d6a7' : '#e8ede8'}`, boxShadow: qty > 0 ? '0 2px 12px rgba(46,125,50,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {/* main row */}
            <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, overflow: 'hidden' }}>
                {v.image_url
                  ? <img src={v.image_url} alt={v.variety_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '🌾'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{v.variety_name}</p>
                <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>🏪 {v.supplier_name}</p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#c62828' }}>{v.price_per_bag.toLocaleString()} บาท</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{v.bag_weight_kg}กก./ถุง</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{v.days_to_harvest ? `${v.days_to_harvest} วัน` : ''}</span>
                </div>
              </div>
              {/* qty controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {qty > 0 && (
                  <button onClick={() => setQty(v, qty - 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e0e0e0', background: '#f5f5f5', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                )}
                {qty > 0 && (
                  <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--primary)', minWidth: 28, textAlign: 'center' }}>{qty}</span>
                )}
                <button onClick={() => setQty(v, qty + 1)}
                  style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: qty > 0 ? 'var(--primary)' : '#e8f5e9', color: qty > 0 ? '#fff' : 'var(--primary)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
              </div>
            </div>

            {/* expand detail */}
            <button onClick={() => setExpandedId(expanded ? null : v.id)}
              style={{ width: '100%', padding: '8px 16px', background: '#f7faf7', border: 'none', borderTop: '1px solid #f0f4f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#4a6741', fontWeight: 600 }}>
              <span>ℹ️ รายละเอียดพันธุ์{v.days_to_harvest ? ` · ${v.days_to_harvest} วัน` : ''}</span>
              <span style={{ fontSize: 16, transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>⌄</span>
            </button>

            {expanded && (
              <div style={{ padding: '12px 16px', background: '#f7faf7', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                  {[
                    { label: 'อายุปลูก', value: v.days_to_harvest ? `${v.days_to_harvest} วัน` : '—' },
                    { label: 'น้ำหนัก/ถุง', value: `${v.bag_weight_kg} กก.` },
                  ].map((s) => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {v.notes && <p style={{ margin: 0, fontSize: 13, color: '#4a6741', background: '#e8f5e9', borderRadius: 10, padding: '8px 12px' }}>💡 {v.notes}</p>}
                {v.planting_guide && <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>📋 {v.planting_guide}</p>}
              </div>
            )}
          </div>
        );
      })}

      {/* pickup date + note */}
      {varieties.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e8ede8', padding: '16px' }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>📅 เลือกรอบรับสินค้า</p>
          {slots.length === 0 ? (
            <div style={{ background: '#fff8e1', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#e65100' }}>
              ⏳ ยังไม่มีรอบรับสินค้าที่เปิด — admin จะแจ้งให้ทราบ
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map((slot) => {
                const loc     = slot.pickup_locations;
                const remain  = slot.capacity_qty - slot.booked_qty;
                const selected = selSlotId === slot.id;
                const full    = remain <= 0;
                return (
                  <button key={slot.id} onClick={() => !full && setSelSlotId(selected ? '' : slot.id)} disabled={full}
                    style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: `2px solid ${selected ? 'var(--primary)' : '#e4ebe4'}`, background: selected ? '#e8f5e9' : full ? '#f5f5f5' : '#fff', cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>📅 {new Date(slot.pickup_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#4a6741' }}>⏰ {slot.pickup_time}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>📍 {loc?.name ?? '—'}{loc?.address ? ` · ${loc.address}` : ''}</p>
                        {slot.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{slot.note}</p>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: full ? '#c62828' : '#2e7d32' }}>{full ? 'เต็ม' : `เหลือ ${remain} ถุง`}</p>
                        {selected && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>✓ เลือกแล้ว</p>}
                        {loc?.map_url && (
                          <a href={loc.map_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: '#1565c0', textDecoration: 'none', fontWeight: 600 }}>🗺️ แผนที่</a>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <label className="reg-label" style={{ marginTop: 12 }}>หมายเหตุ
            <textarea className="reg-input reg-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ให้หัวหน้าทีมรับแทน..." />
          </label>
        </div>
      )}

      {/* history link */}
      <button onClick={() => setScreen('history')}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: '4px 0', textAlign: 'center' }}>
        📋 ดูประวัติการจอง ({reservations.length} รายการ)
      </button>

      {/* sticky summary + submit */}
      {totalBags > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1.5px solid #e4ebe4', padding: '12px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
            <span>จำนวนรวม {totalBags} ถุง · {totalKg.toLocaleString()} กก.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>ยอดจอง</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#1b5e20' }}>{totalBaht.toLocaleString()} บาท</span>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af' }}>💰 ชำระเมื่อมารับสินค้า — ไม่ต้องจ่ายตอนจอง</p>
          <button onClick={submit} disabled={saving}
            style={{ width: '100%', padding: '14px', borderRadius: 16, border: 'none', background: saving ? '#9ca3af' : '#2e7d32', color: '#fff', fontWeight: 800, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            🛒 {saving ? 'กำลังจอง…' : `ยืนยันจอง ${totalBags} ถุง`}
          </button>
        </div>
      )}
    </div>
  );
}
