'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type Lot = {
  id: string; lot_no: string; received_date: string;
  variety_name: string; crop_type: string;
  supplier_name: string | null;
  quantity_balance: number; price_per_bag: number;
  bag_weight_kg: number; status: string;
  balance_pct: number;
  // จาก variety
  days_to_harvest: number | null; planting_guide: string | null;
};

type MyReservation = {
  id: string; reservation_no: string; status: string;
  qty_reserved: number; total_amount: number;
  pickup_date: string | null; variety_name: string;
  created_at: string;
};

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '⏳ รอยืนยัน', color: '#e65100', bg: '#fff8e1' },
  confirmed: { label: '✅ ยืนยัน',   color: '#2e7d32', bg: '#e8f5e9' },
  completed: { label: '🏁 รับแล้ว',  color: '#1565c0', bg: '#e3f2fd' },
  cancelled: { label: '⛔ ยกเลิก',   color: '#9e9e9e', bg: '#f5f5f5' },
};

export function MemberSeedReservation() {
  const [lots, setLots]         = useState<Lot[]>([]);
  const [myRes, setMyRes]       = useState<MyReservation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'catalog' | 'history'>('catalog');
  const [selected, setSelected] = useState<Lot | null>(null);
  const [qty, setQty]           = useState('1');
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data: lotData } = await s.from('admin_seed_lot_status')
      .select('id,lot_no,received_date,variety_name,crop_type,supplier_name,quantity_balance,price_per_bag,bag_weight_kg,status,balance_pct')
      .eq('status', 'available')
      .gt('quantity_balance', 0)
      .order('variety_name');

    const resRes = await fetch('/api/member/reservation');
    const resPayload = (await resRes.json()) as { items?: MyReservation[] };

    setLots((lotData as Lot[]) ?? []);
    setMyRes(resPayload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  async function submitReservation() {
    if (!selected || !qty || Number(qty) <= 0) return;
    setSubmitting(true); setError(null);
    const res = await fetch('/api/member/reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lot_id: selected.id, qty: Number(qty), pickup_date: pickupDate || null, note: note || null }),
    });
    const payload = (await res.json()) as { ok?: boolean; reservation_no?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(payload.error ?? 'จองไม่สำเร็จ'); return; }
    setNotice(`✅ จองแล้ว ${payload.reservation_no} — รอ admin ยืนยัน`);
    setSelected(null); setQty('1'); setPickupDate(''); setNote('');
    setTab('history');
    await loadData();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div className="mobile-stack">
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['catalog', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: tab === t ? 'var(--primary)' : '#f0f4f0', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
            {t === 'catalog' ? '🌾 เมล็ดพันธุ์' : `📋 การจองของฉัน${myRes.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length > 0 ? ` (${myRes.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <>
          {lots.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: 14 }}>ไม่มีเมล็ดพันธุ์ในสต๊อกขณะนี้</p>}
          {lots.map((lot) => (
            <div key={lot.id} className="kaona-card" style={{ borderColor: selected?.id === lot.id ? 'var(--primary)' : 'var(--border)', background: selected?.id === lot.id ? '#f1f8f1' : '#fff', cursor: 'pointer' }} onClick={() => setSelected(selected?.id === lot.id ? null : lot)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{lot.variety_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{lot.crop_type} {lot.supplier_name ? `· ${lot.supplier_name}` : ''}</p>
                  {lot.days_to_harvest && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--primary)' }}>🌾 เก็บเกี่ยวใน {lot.days_to_harvest} วัน</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 900, color: 'var(--primary)', fontSize: 18 }}>{lot.price_per_bag.toLocaleString()}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>บาท/ถุง ({lot.bag_weight_kg} กก.)</p>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>สต๊อกคงเหลือ</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: lot.status === 'low' ? '#e65100' : '#2e7d32' }}>{lot.quantity_balance} ถุง</span>
                </div>
                <div className="plot-card__progress-bar">
                  <div className="plot-card__progress-fill" style={{ width: `${lot.balance_pct}%`, background: lot.balance_pct <= 10 ? '#e65100' : 'var(--primary)' }} />
                </div>
              </div>

              {/* Form จอง */}
              {selected?.id === lot.id && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  {error && <div style={{ background: '#ffebee', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#c62828', marginBottom: 8 }}>⚠️ {error}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="reg-label" style={{ fontSize: 13 }}>จำนวน (ถุง) <span className="reg-required">*</span>
                      <input className="reg-input" type="number" min="1" max={lot.quantity_balance} value={qty} onChange={(e) => setQty(e.target.value)} />
                    </label>
                    <label className="reg-label" style={{ fontSize: 13 }}>วันนัดรับ
                      <input className="reg-input" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={new Date().toISOString().slice(0,10)} />
                    </label>
                  </div>
                  {qty && Number(qty) > 0 && (
                    <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#1b5e20', margin: '8px 0' }}>
                      ยอดรวม: {(Number(qty) * lot.price_per_bag).toLocaleString()} บาท
                    </div>
                  )}
                  <label className="reg-label" style={{ fontSize: 13 }}>หมายเหตุ
                    <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ต้องการข้อมูลเพิ่มเติม…" />
                  </label>
                  <UIButton fullWidth onClick={submitReservation} loading={submitting} disabled={submitting || !qty || Number(qty) <= 0}>
                    📋 ยืนยันการจอง
                  </UIButton>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* History */}
      {tab === 'history' && (
        <>
          {myRes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: 14 }}>ยังไม่มีรายการจอง</p>}
          {myRes.map((r) => {
            const st = STATUS_TH[r.status] ?? { label: r.status, color: '#666', bg: '#f5f5f5' };
            return (
              <div key={r.id} className="kaona-card" style={{ background: st.bg, borderColor: st.color + '66' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{r.variety_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.reservation_no}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>{r.qty_reserved} ถุง — {r.total_amount.toLocaleString()} บาท</p>
                    {r.pickup_date && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>นัดรับ {new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
