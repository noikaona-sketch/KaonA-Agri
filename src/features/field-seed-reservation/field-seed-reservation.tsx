'use client';

import { useEffect, useState, useRef } from 'react';
import { useCurrentMember }            from '@/providers/auth-provider';
import { LoadingState }                from '@/shared/components/loading-state';

type SeedProduct  = { id: string; product_id: string; variety_name: string; price_per_bag: number; bag_weight_kg: number; crop_type: string; days_to_harvest: number | null };
type MemberResult = { id: string; full_name: string; phone: string | null };
type SeedReservation = {
  id: string; reservation_no: string; status: string;
  qty_reserved: number; total_amount: number | null; price_per_bag: number;
  pickup_date: string | null; variety_name: string; created_at: string; note: string | null;
  source_channel: string | null;
  member?: { full_name: string; phone: string | null } | null;
};
type PickupSlot = {
  id: string; pickup_date: string; pickup_time: string;
  capacity_qty: number; booked_qty: number; status: string;
  pickup_locations: { name: string; address: string | null } | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  pending:   { icon: '⏳', label: 'รอยืนยัน',   color: '#e65100', bg: '#fff8e1' },
  confirmed: { icon: '✅', label: 'ยืนยันแล้ว', color: '#1565c0', bg: '#e3f2fd' },
  partial:   { icon: '⏳', label: 'ค้างบางส่วน', color: '#e65100', bg: '#fff8e1' },
  completed: { icon: '🏁', label: 'รับของแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
  converted: { icon: '💰', label: 'รับของแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
  cancelled: { icon: '❌', label: 'ยกเลิก',      color: '#c62828', bg: '#ffebee' },
};
const SOURCE_CHANNELS = ['ภาคสนาม','โทรศัพท์','Line','หน้าร้าน','อื่นๆ'];

export function FieldSeedReservation() {
  const member  = useCurrentMember();
  const staffId = member?.member_id ?? '';

  const [tab,         setTab]         = useState<'book' | 'history'>('book');
  const [products,    setProducts]    = useState<SeedProduct[]>([]);
  const [loadingProd, setLoadingProd] = useState(true);
  const [search,      setSearch]      = useState('');
  const [showDrop,    setShowDrop]    = useState(false);
  const [members,     setMembers]     = useState<MemberResult[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [selMember,   setSelMember]   = useState<MemberResult | null>(null);
  const [memberRes,   setMemberRes]   = useState<SeedReservation[]>([]);
  const [selProduct,  setSelProduct]  = useState<SeedProduct | null>(null);
  const [qty,         setQty]         = useState('1');
  const [note,        setNote]        = useState('');
  const [channel,     setChannel]     = useState('ภาคสนาม');
  const [slots,       setSlots]       = useState<PickupSlot[]>([]);
  const [selSlot,     setSelSlot]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [myHistory,   setMyHistory]   = useState<SeedReservation[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void fetch('/api/member/seed-lots').then((r) => r.json())
      .then((d: { lots?: SeedProduct[] }) => { setProducts(d.lots ?? []); setLoadingProd(false); });
    void fetch('/api/member/pickup-slots').then((r) => r.json())
      .then((d: { slots?: PickupSlot[] }) => setSlots(d.slots ?? []));
  }, []);

  useEffect(() => {
    if (tab !== 'history' || !staffId) return;
    setLoadingHist(true);
    void fetch(`/api/field/seed-reservation?staff_id=${staffId}`)
      .then((r) => r.json())
      .then((d: { reservations?: SeedReservation[] }) => { setMyHistory(d.reservations ?? []); setLoadingHist(false); });
  }, [tab, staffId]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (search.length < 2) { setMembers([]); setShowDrop(false); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      void fetch(`/api/field/seed-reservation?staff_id=${staffId}&search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d: { members?: MemberResult[] }) => {
          setMembers(d.members ?? []);
          setShowDrop((d.members ?? []).length > 0);
          setSearching(false);
        });
    }, 300);
  }, [search, staffId]);

  async function pickMember(m: MemberResult) {
    setSelMember(m); setSearch(''); setMembers([]); setShowDrop(false);
    const d = await fetch(`/api/field/seed-reservation?staff_id=${staffId}&member_id=${m.id}`)
      .then((r) => r.json()) as { reservations?: SeedReservation[] };
    setMemberRes(d.reservations ?? []);
  }

  async function submit() {
    if (!selMember || !selProduct || Number(qty) <= 0) return;
    setSubmitting(true); setNotice(null);
    const res = await fetch('/api/field/seed-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, member_id: selMember.id, product_id: selProduct.product_id, qty: Number(qty), note: note || null, source_channel: channel, pickup_slot_id: selSlot || null }),
    });
    const d = (await res.json()) as { ok?: boolean; reservation_no?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(`✅ จองแล้ว ${d.reservation_no ?? ''} — รอยืนยัน`);
    setSelProduct(null); setQty('1'); setNote(''); setSelSlot('');
    const upd = await fetch(`/api/field/seed-reservation?staff_id=${staffId}&member_id=${selMember.id}`)
      .then((r) => r.json()) as { reservations?: SeedReservation[] };
    setMemberRes(upd.reservations ?? []);
  }

  if (!staffId) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div className="mobile-stack">
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['book','history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t ? 'var(--primary)' : '#f0f4f0', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
            {t === 'book' ? '📋 จองให้สมาชิก' : '🕐 ประวัติที่จองไว้'}
          </button>
        ))}
      </div>

      {/* ── Tab: จอง ── */}
      {tab === 'book' && (
        <>
          {/* Member search */}
          {selMember ? (
            <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', borderRadius: 16, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900 }}>
                  {selMember.full_name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>👤 {selMember.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8 }}>{selMember.phone ?? ''}</p>
                </div>
              </div>
              <button onClick={() => { setSelMember(null); setMemberRes([]); setSelProduct(null); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, borderRadius: 8, padding: '4px 8px' }}>✕</button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '2px solid var(--primary)', borderRadius: 14, padding: '12px 16px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: 20 }}>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาสมาชิก — ชื่อ หรือ เบอร์โทร…"
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, fontWeight: 500 }}
                  autoComplete="off" />
                {searching && <span style={{ fontSize: 12, color: '#9ca3af' }}>⏳</span>}
              </div>
              {/* dropdown — ไม่ใช้ position:absolute เพื่อหลีกเลี่ยงปัญหา scroll */}
              {showDrop && members.length > 0 && (
                <div style={{ background: '#fff', border: '2px solid var(--primary)', borderRadius: 14, marginTop: 6, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  <p style={{ margin: 0, padding: '8px 16px', fontSize: 12, color: '#6b7280', background: '#f9fafb', fontWeight: 600 }}>
                    พบ {members.length} รายการ — กดเลือก
                  </p>
                  {members.map((m) => (
                    <button key={m.id} onClick={() => void pickMember(m)}
                      style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', borderTop: '1px solid #f0f4f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--primary)', fontSize: 16, flexShrink: 0 }}>
                        {m.full_name[0]}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{m.full_name}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: '#6b7280' }}>{m.phone ?? ''}</p>
                      </div>
                      <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: 20 }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* การจองที่มีอยู่ */}
          {selMember && memberRes.length > 0 && (
            <div style={{ background: '#fff8e1', borderRadius: 12, padding: '10px 14px', border: '1px solid #ffe082' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: '#e65100' }}>📋 การจองที่มีอยู่แล้ว</p>
              {memberRes.map((r) => {
                const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6, border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{r.variety_name} × {r.qty_reserved} ถุง</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.reservation_no}</p>
                    </div>
                    <span style={{ fontSize: 11, background: st.bg, color: st.color, borderRadius: 6, padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>{st.icon} {st.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* เลือกสินค้า */}
          {selMember && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>🌾 เลือกเมล็ดพันธุ์</p>
                <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
              </div>
              {loadingProd ? <LoadingState label="กำลังโหลด…" /> : (
                products.length === 0
                  ? <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '16px 0' }}>ไม่มีเมล็ดพันธุ์ในระบบ</p>
                  : products.map((p) => (
                    <div key={p.id} onClick={() => setSelProduct(selProduct?.id === p.id ? null : p)}
                      style={{ background: selProduct?.id === p.id ? '#e8f5e9' : '#fff', border: `2px solid ${selProduct?.id === p.id ? 'var(--primary)' : '#e8e8e8'}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{p.variety_name}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                            {p.crop_type}{p.days_to_harvest ? ` · ${p.days_to_harvest} วัน` : ''} · {p.bag_weight_kg} กก./ถุง
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontWeight: 900, color: 'var(--primary)', fontSize: 20 }}>{p.price_per_bag.toLocaleString()}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>บาท/ถุง</p>
                        </div>
                      </div>

                      {selProduct?.id === p.id && (
                        <div style={{ borderTop: '1px solid #c8e6c9', marginTop: 14, paddingTop: 14 }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <label className="reg-label" style={{ fontSize: 13 }}>จำนวน (ถุง) *
                              <input className="reg-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                            </label>
                            <label className="reg-label" style={{ fontSize: 13 }}>ช่องทาง
                              <select className="reg-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                                {SOURCE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </label>
                          </div>

                          {/* วันนัดรับ */}
                          <label className="reg-label" style={{ fontSize: 13, marginBottom: 10 }}>📅 วันนัดรับสินค้า
                            <select className="reg-input" value={selSlot} onChange={(e) => setSelSlot(e.target.value)}>
                              <option value="">— ไม่ระบุรอบ —</option>
                              {slots.map((sl) => {
                                const loc     = sl.pickup_locations;
                                const remain  = (sl.capacity_qty ?? 0) - (sl.booked_qty ?? 0);
                                const dateStr = new Date(sl.pickup_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                return (
                                  <option key={sl.id} value={sl.id} disabled={remain <= 0}>
                                    {dateStr} {sl.pickup_time} · {loc?.name ?? ''} {remain > 0 ? `(เหลือ ${remain} ถุง)` : '(เต็ม)'}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          {Number(qty) > 0 && (
                            <div style={{ background: 'var(--primary)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                              <span style={{ fontWeight: 700 }}>ยอดรวม</span>
                              <span style={{ fontWeight: 900, fontSize: 16 }}>{(Number(qty) * p.price_per_bag).toLocaleString()} บาท</span>
                            </div>
                          )}
                          <label className="reg-label" style={{ fontSize: 13 }}>หมายเหตุ
                            <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="บันทึกเพิ่มเติม…" />
                          </label>
                          <button onClick={submit} disabled={submitting || Number(qty) <= 0}
                            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: submitting ? '#9ca3af' : 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
                            {submitting ? 'กำลังจอง…' : `📋 จองให้ ${selMember.full_name}`}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab: ประวัติ ── */}
      {tab === 'history' && (
        <>
          {loadingHist && <LoadingState label="กำลังโหลด…" />}
          {!loadingHist && myHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 40 }}>📋</p>
              <p style={{ fontSize: 14 }}>ยังไม่มีการจอง</p>
            </div>
          )}
          {myHistory.map((r) => {
            const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
            const m  = r.member;
            return (
              <div key={r.id} style={{ background: '#fff', border: `1.5px solid ${st.color}44`, borderRadius: 14, padding: '14px 16px', borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: st.color }}>
                      {m?.full_name?.[0] ?? '?'}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{m?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{m?.phone ?? ''}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 6, padding: '3px 8px', alignSelf: 'flex-start' }}>{st.icon} {st.label}</span>
                </div>
                <p style={{ margin: '6px 0 2px', fontSize: 14, fontWeight: 700 }}>
                  {r.variety_name} × {r.qty_reserved} ถุง
                  <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}> · {(r.total_amount ?? r.qty_reserved * r.price_per_bag).toLocaleString()} บาท</span>
                </p>
                {r.pickup_date && <p style={{ margin: '2px 0', fontSize: 12, color: '#1565c0' }}>📅 {new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                {r.source_channel && <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>📡 {r.source_channel}</p>}
                {r.note && <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>📝 {r.note}</p>}
                <p style={{ margin: '6px 0 0', fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>{r.reservation_no}</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
