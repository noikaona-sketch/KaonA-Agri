'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentMember }            from '@/providers/auth-provider';
import { LoadingState }                from '@/shared/components/loading-state';
import { SeedReservationFlow }         from '@/features/member-seed-reservation/seed-reservation-flow';

type MemberResult = { id: string; full_name: string; phone: string | null };

// ── MemberPicker ────────────────────────────────────────────────────
function MemberPicker({ staffId, onSelect }: { staffId: string; onSelect: (m: MemberResult | null) => void }) {
  const [search,    setSearch]    = useState('');
  const [results,   setResults]   = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected,  setSelected]  = useState<MemberResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (search.length < 2) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      void fetch(`/api/field/seed-reservation?staff_id=${staffId}&search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d: { members?: MemberResult[] }) => { setResults(d.members ?? []); setSearching(false); });
    }, 300);
  }, [search, staffId]);

  function pick(m: MemberResult) {
    setSelected(m); onSelect(m); setSearch(''); setResults([]);
  }

  function clear() {
    setSelected(null); onSelect(null); setSearch(''); setResults([]);
  }

  if (selected) return (
    <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', borderRadius: 18, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>
          {selected.full_name[0]}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>👤 {selected.full_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.8 }}>{selected.phone ?? ''}</p>
        </div>
      </div>
      <button onClick={clear} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>
        เปลี่ยน
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '2px solid var(--primary)', borderRadius: 16, padding: '13px 16px', background: '#fff', boxShadow: '0 2px 8px rgba(27,94,32,0.08)' }}>
        <span style={{ fontSize: 22 }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off"
          placeholder="ค้นหาสมาชิก — ชื่อ หรือ เบอร์โทร…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, fontWeight: 500 }} />
        {searching && <span style={{ fontSize: 13, color: '#9ca3af' }}>⏳</span>}
      </div>

      {results.length > 0 && (
        <div style={{ background: '#fff', border: '2px solid var(--primary)', borderRadius: 16, marginTop: 8, overflow: 'hidden', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '8px 16px', background: '#f0faf0', borderBottom: '1px solid #e8ede8' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>พบ {results.length} สมาชิก — กดเลือก</p>
          </div>
          {results.map((m) => (
            <button key={m.id} onClick={() => pick(m)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', borderTop: '1px solid #f0f4f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--primary)', fontSize: 18, flexShrink: 0 }}>
                {m.full_name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{m.full_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{m.phone ?? ''}</p>
              </div>
              <span style={{ color: 'var(--primary)', fontSize: 22 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FieldSeedReservation ────────────────────────────────────────────
export function FieldSeedReservation() {
  const staff   = useCurrentMember();
  const staffId = staff?.member_id ?? '';

  const [selMember, setSelMember] = useState<MemberResult | null>(null);
  const [tab, setTab] = useState<'book' | 'history'>('book');

  if (!staffId) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div className="mobile-stack">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('book')} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'book' ? 'var(--primary)' : '#f0f4f0', color: tab === 'book' ? '#fff' : 'var(--text-secondary)' }}>
          📋 จองให้สมาชิก
        </button>
        <button onClick={() => setTab('history')} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'history' ? 'var(--primary)' : '#f0f4f0', color: tab === 'history' ? '#fff' : 'var(--text-secondary)' }}>
          🕐 ประวัติที่จองไว้
        </button>
      </div>

      {tab === 'book' && (
        <>
          {/* ค้นหาสมาชิก */}
          <MemberPicker staffId={staffId} onSelect={(m) => { setSelMember(m); }} />

          {!selMember && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: 40, margin: '0 0 8px' }}>👆</p>
              <p style={{ fontSize: 14, fontWeight: 600 }}>ค้นหาสมาชิกก่อนจอง</p>
              <p style={{ fontSize: 12 }}>พิมพ์ชื่อหรือเบอร์โทรด้านบน</p>
            </div>
          )}

          {/* เมื่อเลือกสมาชิกแล้ว — ใช้ SeedReservationFlow แบบ override member_id */}
          {selMember && (
            <FieldMemberReservation
              staffId={staffId}
              memberId={selMember.id}
              memberName={selMember.full_name}
            />
          )}
        </>
      )}

      {tab === 'history' && (
        <FieldHistoryTab staffId={staffId} />
      )}
    </div>
  );
}

// ── FieldMemberReservation — SeedReservationFlow สำหรับ field ────────
// Mock useCurrentMember ไม่ได้ — ต้องทำ inline version ที่ใช้ field API แทน
function FieldMemberReservation({ staffId, memberId, memberName }: { staffId: string; memberId: string; memberName: string }) {
  type Variety = { id: string; product_id: string; variety_name: string; supplier_name: string; price_per_bag: number; bag_weight_kg: number; crop_type: string; days_to_harvest: number | null };
  type Slot    = { id: string; pickup_date: string; pickup_time: string; capacity_qty: number; booked_qty: number; status: string; pickup_locations: { name: string; address: string | null } | null };

  const [varieties,  setVarieties]  = useState<Variety[]>([]);
  const [slots,      setSlots]      = useState<Slot[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selSlotId,  setSelSlotId]  = useState('');
  const [note,       setNote]       = useState('');
  const [channel,    setChannel]    = useState('ภาคสนาม');
  const [cart,       setCart]       = useState<{ variety: Variety; qty: number }[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      fetch('/api/member/seed-lots').then((r) => r.json()),
      fetch('/api/member/pickup-slots').then((r) => r.json()),
    ]).then(([lots, slotRes]) => {
      setVarieties(((lots as { lots?: Record<string,unknown>[] }).lots ?? []).map((l) => ({
        id: l.id as string, product_id: (l.product_id ?? l.id) as string,
        variety_name: l.variety_name as string,
        supplier_name: (l.supplier_name as string) ?? '—',
        price_per_bag: Number(l.price_per_bag ?? 0),
        bag_weight_kg: Number(l.bag_weight_kg ?? 1),
        crop_type: (l.crop_type as string) ?? '',
        days_to_harvest: (l.days_to_harvest as number | null) ?? null,
      })));
      setSlots((slotRes as { slots?: Slot[] }).slots ?? []);
      setLoading(false);
    });
  }, []);

  function getQty(id: string) { return cart.find((c) => c.variety.id === id)?.qty ?? 0; }
  function setQty(v: Variety, qty: number) {
    const safe = Math.max(0, qty);
    setCart((prev) => {
      const exists = prev.find((c) => c.variety.id === v.id);
      if (safe === 0) return prev.filter((c) => c.variety.id !== v.id);
      if (exists) return prev.map((c) => c.variety.id === v.id ? { ...c, qty: safe } : c);
      return [...prev, { variety: v, qty: safe }];
    });
  }

  const totalBags = cart.reduce((s, c) => s + c.qty, 0);
  const totalAmt  = cart.reduce((s, c) => s + c.qty * c.variety.price_per_bag, 0);
  const SOURCE_CHANNELS = ['ภาคสนาม','โทรศัพท์','Line','หน้าร้าน','อื่นๆ'];

  async function submit() {
    if (cart.length === 0) return;
    setSaving(true); setNotice(null);
    const results: string[] = [];
    for (const item of cart) {
      if (!item.variety.product_id) { setNotice('❌ เมล็ดพันธุ์นี้ยังไม่ได้สร้างใน Product Master'); setSaving(false); return; }
      const res = await fetch('/api/field/seed-reservation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, member_id: memberId, product_id: item.variety.product_id, qty: item.qty, note: note || null, source_channel: channel, pickup_slot_id: selSlotId || null }),
      });
      const d = (await res.json()) as { ok?: boolean; reservation_no?: string; error?: string };
      if (!res.ok) { setNotice(`❌ ${d.error}`); setSaving(false); return; }
      results.push(d.reservation_no ?? '');
    }
    setNotice(`✅ จองให้ ${memberName} แล้ว ${results.length} รายการ — รอยืนยัน`);
    setCart([]); setSelSlotId(''); setNote('');
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      {/* สินค้า */}
      {varieties.map((v) => {
        const qty       = getQty(v.id);
        const expanded  = expandedId === v.id;
        const totalBag  = qty * v.price_per_bag;
        return (
          <div key={v.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: qty > 0 ? '2px solid var(--primary)' : '1.5px solid #e8ede8', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🌾</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.variety_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {v.crop_type}{v.days_to_harvest ? ` · ${v.days_to_harvest} วัน` : ''} · {v.bag_weight_kg} กก./ถุง
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{v.supplier_name !== '—' ? v.supplier_name : ''}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 20, color: 'var(--primary)' }}>{v.price_per_bag.toLocaleString()}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>บาท/ถุง</p>
              </div>
            </div>

            {/* Info toggle */}
            <button onClick={() => setExpandedId(expanded ? null : v.id)}
              style={{ width: '100%', padding: '8px 16px', border: 'none', background: '#f9fafb', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: '#1565c0', fontWeight: 600, borderTop: '1px solid #f0f4f0', display: 'flex', justifyContent: 'space-between' }}>
              <span>ℹ️ รายละเอียดพันธุ์{v.days_to_harvest ? ` · ${v.days_to_harvest} วัน` : ''}</span>
              <span>{expanded ? '∧' : '∨'}</span>
            </button>
            {expanded && (
              <div style={{ padding: '10px 16px', background: '#f0faf0', fontSize: 13, color: '#2e7d32', lineHeight: 1.8 }}>
                <p style={{ margin: 0 }}>🌿 ชนิดพืช: {v.crop_type}</p>
                {v.days_to_harvest && <p style={{ margin: 0 }}>📅 อายุเก็บเกี่ยว: {v.days_to_harvest} วัน</p>}
                <p style={{ margin: 0 }}>⚖️ น้ำหนัก: {v.bag_weight_kg} กก./ถุง</p>
              </div>
            )}

            {/* qty control */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f4f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setQty(v, qty - 1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e0e0e0', background: qty > 0 ? '#fff' : '#f5f5f5', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: qty > 0 ? '#c62828' : '#9ca3af' }}>−</button>
                <span style={{ fontWeight: 900, fontSize: 18, minWidth: 28, textAlign: 'center', color: qty > 0 ? 'var(--primary)' : '#9ca3af' }}>{qty}</span>
                <button onClick={() => setQty(v, qty + 1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--primary)', background: '#e8f5e9', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>+</button>
                <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 4 }}>ถุง</span>
              </div>
              {qty > 0 && <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>{totalBag.toLocaleString()} บาท</span>}
            </div>
          </div>
        );
      })}

      {/* รอบรับสินค้า */}
      {slots.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1.5px solid #e8ede8' }}>
          <div style={{ padding: '12px 16px', background: '#f0faf0', borderBottom: '1px solid #e8ede8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1b5e20' }}>เลือกรอบรับสินค้า</p>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map((sl) => {
              const remain  = (sl.capacity_qty ?? 0) - (sl.booked_qty ?? 0);
              const full    = remain <= 0;
              const sel     = selSlotId === sl.id;
              const dateStr = new Date(sl.pickup_date).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <button key={sl.id} onClick={() => !full && setSelSlotId(sel ? '' : sl.id)} disabled={full}
                  style={{ padding: '12px 14px', borderRadius: 14, border: `2px solid ${sel ? 'var(--primary)' : full ? '#e0e0e0' : '#c8e6c9'}`, background: sel ? '#e8f5e9' : full ? '#f5f5f5' : '#fff', cursor: full ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: full ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: full ? '#9ca3af' : '#1b5e20' }}>
                        📅 {dateStr}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>⏰ {sl.pickup_time}</p>
                      {sl.pickup_locations && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>📍 {sl.pickup_locations.name}{sl.pickup_locations.address ? ` · ${sl.pickup_locations.address}` : ''}</p>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: full ? '#c62828' : '#2e7d32', flexShrink: 0 }}>
                      {full ? 'เต็ม' : `เหลือ ${remain.toLocaleString()} ถุง`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ช่องทาง + หมายเหตุ */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', border: '1.5px solid #e8ede8', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="reg-label" style={{ fontSize: 13, margin: 0 }}>📡 ช่องทางการจอง
          <select className="reg-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {SOURCE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="reg-label" style={{ fontSize: 13, margin: 0 }}>หมายเหตุ
          <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ให้หัวหน้าทีมรับแทน…" />
        </label>
      </div>

      {/* Summary + Submit */}
      {totalBags > 0 && (
        <div style={{ background: 'var(--primary)', borderRadius: 18, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
            <span style={{ fontSize: 14, opacity: 0.9 }}>รวม {totalBags} ถุง</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>{totalAmt.toLocaleString()} บาท</span>
          </div>
          <button onClick={submit} disabled={saving}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: saving ? 'rgba(255,255,255,0.3)' : '#fff', color: saving ? '#fff' : 'var(--primary)', fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'กำลังจอง…' : `📋 จอง ${totalBags} ถุง ให้ ${memberName}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── FieldHistoryTab ────────────────────────────────────────────────
function FieldHistoryTab({ staffId }: { staffId: string }) {
  type SeedReservation = {
    id: string; reservation_no: string; status: string;
    qty_reserved: number; total_amount: number | null; price_per_bag: number;
    pickup_date: string | null; variety_name: string; created_at: string;
    note: string | null; source_channel: string | null;
    member?: { full_name: string; phone: string | null } | null;
  };
  const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    pending:   { icon: '⏳', label: 'รอยืนยัน',   color: '#e65100', bg: '#fff8e1' },
    confirmed: { icon: '✅', label: 'ยืนยันแล้ว', color: '#1565c0', bg: '#e3f2fd' },
    completed: { icon: '🏁', label: 'รับของแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
    converted: { icon: '💰', label: 'รับของแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
    cancelled: { icon: '❌', label: 'ยกเลิก',      color: '#c62828', bg: '#ffebee' },
  };
  const [history, setHistory] = useState<SeedReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/field/seed-reservation?staff_id=${staffId}`)
      .then((r) => r.json())
      .then((d: { reservations?: SeedReservation[] }) => { setHistory(d.reservations ?? []); setLoading(false); });
  }, [staffId]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (history.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
      <p style={{ fontSize: 48, margin: '0 0 8px' }}>📋</p>
      <p style={{ fontSize: 14, fontWeight: 600 }}>ยังไม่มีการจอง</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {history.map((r) => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
        const m  = r.member;
        return (
          <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', border: `1.5px solid #e8ede8`, borderLeft: `4px solid ${st.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: st.color, flexShrink: 0 }}>
                  {m?.full_name?.[0] ?? '?'}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{m?.full_name ?? '—'}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{m?.phone ?? ''}</p>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 8, padding: '4px 10px', alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
                {st.icon} {st.label}
              </span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>
              {r.variety_name}
              <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}> × {r.qty_reserved} ถุง · {(r.total_amount ?? r.qty_reserved * r.price_per_bag).toLocaleString()} บาท</span>
            </p>
            {r.pickup_date && <p style={{ margin: '2px 0', fontSize: 12, color: '#1565c0' }}>📅 {new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
            {r.source_channel && <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>📡 {r.source_channel}</p>}
            {r.note && <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>📝 {r.note}</p>}
            <p style={{ margin: '6px 0 0', fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>{r.reservation_no}</p>
          </div>
        );
      })}
    </div>
  );
}
