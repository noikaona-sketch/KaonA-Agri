'use client';

import { useEffect, useState }         from 'react';
import { LoadingState }                 from '@/shared/components/loading-state';
import { UIButton }                     from '@/shared/components/ui-button';
import { ReservationHistoryCard, type MyReservation } from './reservation-history-card';

type SeedProduct = {
  id: string; variety_name: string; supplier_name: string;
  price_per_bag: number; bag_weight_kg: number;
  crop_type: string; days_to_harvest: number | null;
  planting_guide: string | null; image_url: string | null;
  product_id: string;
};

export function MemberSeedReservation() {
  const [products,   setProducts]  = useState<SeedProduct[]>([]);
  const [myRes,      setMyRes]     = useState<MyReservation[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [tab,        setTab]       = useState<'catalog' | 'history'>('catalog');
  const [selected,   setSelected]  = useState<SeedProduct | null>(null);
  const [qty,        setQty]       = useState('1');
  const [pickupDate, setPickupDate]= useState('');
  const [note,       setNote]      = useState('');
  const [submitting, setSubmitting]= useState(false);
  const [notice,     setNotice]    = useState<string | null>(null);
  const [error,      setError]     = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [catRes, resRes] = await Promise.all([
      fetch('/api/member/seed-lots'),
      fetch('/api/member/seed-reservation'),
    ]);
    const catPayload = (await catRes.json()) as { lots?: SeedProduct[] };
    const resPayload = (await resRes.json()) as { reservations?: MyReservation[] };
    setProducts(catPayload.lots ?? []);
    setMyRes(resPayload.reservations ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  async function submitReservation() {
    if (!selected || Number(qty) <= 0) return;
    setSubmitting(true); setError(null);
    const res = await fetch('/api/member/seed-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id:    selected.product_id,
        variety_name:  selected.variety_name,
        supplier_name: selected.supplier_name,
        qty_reserved:  Number(qty),
        price_per_bag: selected.price_per_bag,
        bag_weight_kg: selected.bag_weight_kg,
        pickup_date:   pickupDate || null,
        note:          note || null,
      }),
    });
    const payload = (await res.json()) as { ok?: boolean; reservation_no?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(payload.error ?? 'จองไม่สำเร็จ'); return; }
    setNotice(`✅ จองแล้ว ${payload.reservation_no ?? ''} — รอ admin ยืนยัน`);
    setSelected(null); setQty('1'); setPickupDate(''); setNote('');
    setTab('history');
    await loadData();
  }

  // ── Reorder suggestion (PR4 — issue #213) ────────────────────────────────
  // Derive the single best reorder candidate from history.
  // Priority:
  //   1. product_id exact match against current catalog
  //   2. variety_name / product_name case-insensitive match against catalog display name
  //
  // Only considers seed_reservation and sale_order_reservation sources —
  // sale_order_sale rows use product_name (not seed variety) so they are excluded.
  // No auto submit — CTA only preselects + switches tab.
  function getReorderSuggestion(): {
    historyName: string;
    matchedProduct: SeedProduct | null;
  } | null {
    const seedHistory = myRes.filter(
      (r) => r._source === 'seed_reservation' || r._source === 'sale_order_reservation',
    );
    if (seedHistory.length === 0) return null;

    // Most recent seed history row
    const latest = seedHistory[0];
    const historyName = latest.variety_name || '—';

    // Match priority 1: product_id exact
    const byId = latest.product_id
      ? products.find((p) => p.product_id === latest.product_id) ?? null
      : null;
    if (byId) return { historyName, matchedProduct: byId };

    // Match priority 2: variety_name / product_name case-insensitive
    if (historyName && historyName !== '—') {
      const needle = historyName.trim().toLowerCase();
      const byName = products.find(
        (p) =>
          p.variety_name.toLowerCase() === needle ||
          p.variety_name.toLowerCase().includes(needle) ||
          needle.includes(p.variety_name.toLowerCase()),
      ) ?? null;
      return { historyName, matchedProduct: byName };
    }

    return { historyName, matchedProduct: null };
  }

  const reorderSuggestion = myRes.length > 0 ? getReorderSuggestion() : null;

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  const activeCount = myRes.filter((r) => r.status === 'pending' || r.status === 'confirmed').length;

  return (
    <div className="mobile-stack">
      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {(['catalog', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: tab === t ? 'var(--primary)' : '#f0f4f0',
            color: tab === t ? '#fff' : 'var(--text-secondary)',
          }}>
            {t === 'catalog' ? '🌾 เมล็ดพันธุ์' : `📋 การจองของฉัน${activeCount > 0 ? ` (${activeCount})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <>
          {/* Level 1 UX note — seed reservation allowed without plot */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: '10px 14px', marginBottom: 4,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🌾</span>
            <p style={{ margin: 0, fontSize: 13, color: '#14532d', lineHeight: 1.6 }}>
              ยังไม่เพิ่มแปลงก็จองเมล็ดพันธุ์ได้
            </p>
          </div>

          {products.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0', fontSize: 14 }}>ไม่มีเมล็ดพันธุ์ในขณะนี้</p>
          )}
          {products.map((p) => (
            <div key={p.id} className="kaona-card"
              style={{ borderColor: selected?.id === p.id ? 'var(--primary)' : 'var(--border)', background: selected?.id === p.id ? '#f1f8f1' : '#fff', cursor: 'pointer' }}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{p.variety_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {p.crop_type}{p.supplier_name && p.supplier_name !== '—' ? ` · ${p.supplier_name}` : ''}
                  </p>
                  {p.days_to_harvest && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--primary)' }}>🌾 เก็บเกี่ยวใน {p.days_to_harvest} วัน</p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 900, color: 'var(--primary)', fontSize: 18 }}>{p.price_per_bag.toLocaleString()}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>บาท/ถุง ({p.bag_weight_kg} กก.)</p>
                </div>
              </div>
              {selected?.id === p.id && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  {error && <div style={{ background: '#ffebee', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#c62828', marginBottom: 8 }}>⚠️ {error}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="reg-label" style={{ fontSize: 13 }}>จำนวน (ถุง) <span className="reg-required">*</span>
                      <input className="reg-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                    </label>
                    <label className="reg-label" style={{ fontSize: 13 }}>วันนัดรับ
                      <input className="reg-input" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                    </label>
                  </div>
                  {Number(qty) > 0 && (
                    <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#1b5e20', margin: '8px 0' }}>
                      ยอดรวม: {(Number(qty) * p.price_per_bag).toLocaleString()} บาท
                    </div>
                  )}
                  <label className="reg-label" style={{ fontSize: 13 }}>หมายเหตุ
                    <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ต้องการข้อมูลเพิ่มเติม…" />
                  </label>
                  <UIButton fullWidth onClick={submitReservation} loading={submitting} disabled={submitting || Number(qty) <= 0}>
                    📋 ยืนยันการจอง
                  </UIButton>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'history' && (
        <>
          {/* Reorder suggestion card — shown when history has seed entries */}
          {reorderSuggestion && (
            <div style={{
              background: '#fefce8', border: '1px solid #fde047',
              borderRadius: 12, padding: '14px 16px', marginBottom: 4,
            }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: '#713f12' }}>
                💡 จองพันธุ์เดิมอีกครั้ง
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                คุณเคยใช้เมล็ดพันธุ์{' '}
                <strong>{reorderSuggestion.historyName}</strong>
                {' '}ต้องการจองพันธุ์เดิมอีกหรือไม่?
              </p>
              {reorderSuggestion.matchedProduct ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(reorderSuggestion.matchedProduct);
                    setTab('catalog');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    background: '#d97706', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '9px 18px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  จองพันธุ์เดิม →
                </button>
              ) : (
                <p style={{
                  margin: 0, fontSize: 13, color: '#9ca3af',
                  fontStyle: 'italic',
                }}>
                  ยังไม่มีสินค้านี้ในรอบปัจจุบัน
                </p>
              )}
            </div>
          )}

          {myRes.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '28px 16px',
              background: '#f9fafb', borderRadius: 12,
              border: '1px dashed #d1d5db',
            }}>
              <p style={{ fontSize: 36, margin: '0 0 8px' }}>📋</p>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: '#374151' }}>
                ยังไม่มีประวัติการสั่งซื้อ
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                ประวัติการสั่งซื้อก่อนหน้าจะปรากฏที่นี่หลังจากนำเข้าข้อมูล
              </p>
            </div>
          )}
          {myRes.map((r) => <ReservationHistoryCard key={r.id} r={r} />)}
        </>
      )}
    </div>
  );
}
