'use client';

import { useEffect, useState, useRef } from 'react';
import { useCurrentMember }            from '@/providers/auth-provider';
import { LoadingState }                from '@/shared/components/loading-state';

type SeedProduct  = { id: string; product_id: string; variety_name: string; price_per_bag: number; bag_weight_kg: number; crop_type: string; days_to_harvest: number | null };
type MemberResult = { id: string; full_name: string; phone: string | null; member_number: string | null };
type OrderItem    = { product_name: string; qty: number; unit_price: number; product_unit: string };
type Reservation  = {
  id: string; order_number: string; status: string; total: number; created_at: string; note: string | null;
  member?: { full_name: string; phone: string | null } | null;
  order_items: OrderItem[];
  pickup_slots?: { pickup_date: string; pickup_time: string; pickup_locations: { name: string } | null } | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  pending:   { icon: '⏳', label: 'รอยืนยัน',   color: '#e65100', bg: '#fff8e1' },
  confirmed: { icon: '✅', label: 'ยืนยันแล้ว', color: '#1565c0', bg: '#e3f2fd' },
  completed: { icon: '🏁', label: 'รับของแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
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
  const [members,     setMembers]     = useState<MemberResult[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [selMember,   setSelMember]   = useState<MemberResult | null>(null);
  const [memberRes,   setMemberRes]   = useState<Reservation[]>([]);
  const [selProduct,  setSelProduct]  = useState<SeedProduct | null>(null);
  const [qty,         setQty]         = useState('1');
  const [note,        setNote]        = useState('');
  const [channel,     setChannel]     = useState('ภาคสนาม');
  const [submitting,  setSubmitting]  = useState(false);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [myHistory,   setMyHistory]   = useState<Reservation[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void fetch('/api/member/seed-lots').then((r) => r.json())
      .then((d: { lots?: SeedProduct[] }) => { setProducts(d.lots ?? []); setLoadingProd(false); });
  }, []);

  useEffect(() => {
    if (tab !== 'history' || !staffId) return;
    setLoadingHist(true);
    void fetch(`/api/field/seed-reservation?staff_id=${staffId}`)
      .then((r) => r.json())
      .then((d: { reservations?: Reservation[] }) => { setMyHistory(d.reservations ?? []); setLoadingHist(false); });
  }, [tab, staffId]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (search.length < 2) { setMembers([]); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      void fetch(`/api/field/seed-reservation?staff_id=${staffId}&search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d: { members?: MemberResult[] }) => { setMembers(d.members ?? []); setSearching(false); });
    }, 300);
  }, [search, staffId]);

  async function pickMember(m: MemberResult) {
    setSelMember(m); setSearch(''); setMembers([]);
    const d = await fetch(`/api/field/seed-reservation?staff_id=${staffId}&member_id=${m.id}`)
      .then((r) => r.json()) as { reservations?: Reservation[] };
    setMemberRes(d.reservations ?? []);
  }

  async function submit() {
    if (!selMember || !selProduct || Number(qty) <= 0) return;
    setSubmitting(true); setNotice(null);
    const res = await fetch('/api/field/seed-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, member_id: selMember.id, product_id: selProduct.product_id, qty: Number(qty), note: note || null, source_channel: channel }),
    });
    const d = (await res.json()) as { ok?: boolean; order_number?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(`✅ จองแล้ว ${d.order_number ?? ''}`);
    setSelProduct(null); setQty('1'); setNote('');
    const upd = await fetch(`/api/field/seed-reservation?staff_id=${staffId}&member_id=${selMember.id}`)
      .then((r) => r.json()) as { reservations?: Reservation[] };
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

      <div style={{ display: 'flex', gap: 8 }}>
        {(['book','history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t ? 'var(--primary)' : '#f0f4f0', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
            {t === 'book' ? '📋 จองให้สมาชิก' : '🕐 ประวัติที่จองไว้'}
          </button>
        ))}
      </div>

      {tab === 'book' && (
        <>
          {/* ค้นหาสมาชิก */}
          <div style={{ position: 'relative' }}>
            {selMember ? (
              <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid #a5d6a7' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>👤 {selMember.full_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4a6741' }}>{selMember.phone ?? ''}</p>
                </div>
                <button onClick={() => { setSelMember(null); setMemberRes([]); setSelProduct(null); }}
                  style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 20 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #e0e0e0', borderRadius: 12, padding: '10px 14px', background: '#fff' }}>
                <span>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาสมาชิก — ชื่อ / เบอร์ / รหัส…"
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }} />
                {searching && <span style={{ fontSize: 12, color: '#9ca3af' }}>⏳</span>}
              </div>
            )}
            {members.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--primary)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, marginTop: 4 }}>
                {members.map((m) => (
                  <button key={m.id} onMouseDown={() => void pickMember(m)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f0f4f0' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{m.full_name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, color: '#6b7280' }}>{m.phone ?? ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* การจองที่มีอยู่ของสมาชิก */}
          {selMember && memberRes.length > 0 && (
            <div style={{ background: '#fff8e1', borderRadius: 12, padding: '10px 14px', border: '1px solid #ffe082' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: '#e65100' }}>📋 การจองที่มีอยู่แล้ว</p>
              {memberRes.map((r) => {
                const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
                const item = r.order_items?.[0];
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{item?.product_name ?? '—'} × {item?.qty}</p>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{st.icon} {st.label}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.order_number}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* เลือกสินค้า */}
          {selMember && (
            <>
              <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 14 }}>🌾 เลือกเมล็ดพันธุ์</p>
              {loadingProd ? <LoadingState label="กำลังโหลด…" /> : products.map((p) => (
                <div key={p.id} onClick={() => setSelProduct(selProduct?.id === p.id ? null : p)}
                  style={{ background: selProduct?.id === p.id ? '#e8f5e9' : '#fff', border: `2px solid ${selProduct?.id === p.id ? 'var(--primary)' : '#e0e0e0'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800 }}>{p.variety_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{p.crop_type}{p.days_to_harvest ? ` · ${p.days_to_harvest} วัน` : ''} · {p.bag_weight_kg} กก./ถุง</p>
                    </div>
                    <p style={{ margin: 0, fontWeight: 900, color: 'var(--primary)', fontSize: 18 }}>{p.price_per_bag.toLocaleString()} ฿</p>
                  </div>
                  {selProduct?.id === p.id && (
                    <div style={{ borderTop: '1px solid #e0e0e0', marginTop: 12, paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label className="reg-label" style={{ fontSize: 13 }}>จำนวน (ถุง) *
                          <input className="reg-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                        </label>
                        <label className="reg-label" style={{ fontSize: 13 }}>ช่องทาง
                          <select className="reg-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                            {SOURCE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                      </div>
                      {Number(qty) > 0 && (
                        <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#1b5e20', margin: '8px 0' }}>
                          ยอดรวม: {(Number(qty) * p.price_per_bag).toLocaleString()} บาท
                        </div>
                      )}
                      <label className="reg-label" style={{ fontSize: 13 }}>หมายเหตุ
                        <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="บันทึกเพิ่มเติม…" />
                      </label>
                      <button onClick={submit} disabled={submitting || Number(qty) <= 0}
                        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: submitting ? '#9ca3af' : 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
                        {submitting ? 'กำลังจอง…' : `📋 จองให้ ${selMember.full_name}`}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {loadingHist && <LoadingState label="กำลังโหลด…" />}
          {!loadingHist && myHistory.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: 14 }}>ยังไม่มีการจอง</p>
          )}
          {myHistory.map((r) => {
            const st   = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
            const item = r.order_items?.[0];
            const m    = r.member;
            const slot = r.pickup_slots;
            return (
              <div key={r.id} style={{ background: st.bg, border: `1px solid ${st.color}44`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>👤 {m?.full_name ?? '—'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{m?.phone ?? ''}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.color, background: '#fff', borderRadius: 6, padding: '2px 8px' }}>{st.icon} {st.label}</span>
                </div>
                <p style={{ margin: '4px 0 2px', fontSize: 13, fontWeight: 700 }}>{item?.product_name ?? '—'} × {item?.qty} ถุง · {r.total.toLocaleString()} บาท</p>
                {slot && <p style={{ margin: 0, fontSize: 12, color: '#1565c0' }}>📅 {new Date(slot.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} {slot.pickup_time}</p>}
                {r.note && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>📝 {r.note}</p>}
                <p style={{ margin: '4px 0 0', fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>{r.order_number}</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
