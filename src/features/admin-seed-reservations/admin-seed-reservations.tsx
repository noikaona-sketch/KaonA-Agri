'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState }   from '@/shared/components/error-state';

// ── Types ────────────────────────────────────────────────────────────
type Reservation = {
  id: string;
  reservation_no: string;
  status: string;
  qty_reserved: number;
  qty_received: number | null;
  price_per_bag: number;
  total_amount: number;
  pickup_date: string | null;
  note: string | null;
  member_name: string;
  member_phone: string | null;
  // product master (new path)
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  product_unit: string | null;
  // seed metadata (optional via variety link)
  variety_name: string | null;
  crop_type: string | null;
  // legacy snapshot fallback
  variety_name_snapshot: string | null;
  supplier_name: string | null;
  created_at: string;
  stock_deducted: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:   { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed: { badge: 'approved',  label: '✅ ยืนยัน'   },
  completed: { badge: 'approved',  label: '🏁 รับแล้ว'  },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก'   },
};

function displayProductName(r: Reservation): string {
  return r.product_name ?? r.variety_name ?? r.variety_name_snapshot ?? '—';
}

// ── Component ────────────────────────────────────────────────────────
export function AdminSeedReservations() {
  const router = useRouter();

  const [items,        setItems]        = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);
  const [notice,       setNotice]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // ── Data ────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/admin/seed-reservations${statusFilter ? `?status=${statusFilter}` : ''}`
    );
    const payload = (await res.json()) as { items?: Reservation[]; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  // ── Actions ─────────────────────────────────────────────────────────
  async function doAction(action: 'confirm' | 'cancel', id: string) {
    if (action === 'cancel' && !window.confirm('ยกเลิกการจองนี้?')) return;
    setActing(id); setNotice(null);
    const res = await fetch('/api/admin/seed-reservations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, reservation_id: id }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null);
    if (!res.ok) { setNotice(`❌ ${payload.error}`); return; }
    setNotice(action === 'confirm' ? '✅ ยืนยันแล้ว' : '⛔ ยกเลิกแล้ว');
    await load();
  }

  // ── Open POS with reservation pre-filled ────────────────────────────
  function openInPos(r: Reservation) {
    router.push(`/admin/pos?reservation_no=${encodeURIComponent(r.reservation_no)}`);
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div>
      {notice && (
        <div style={{
          background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`,
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828',
        }}>
          {notice}
        </div>
      )}

      {pendingCount > 0 && (
        <div style={{
          background: '#fff8e1', border: '1px solid #ffe082',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          fontWeight: 600, color: '#e65100', fontSize: 14,
        }}>
          ⏳ รอยืนยัน {pendingCount} รายการ
        </div>
      )}

      <div className="admin-filter-bar">
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอยืนยัน</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="completed">🏁 รับแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>สมาชิก</th>
                <th>สินค้า / เมล็ดพันธุ์</th>
                <th>จำนวน</th>
                <th>ยอด</th>
                <th>วันนัดรับ</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'center' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    ไม่มีรายการจอง
                  </td>
                </tr>
              )}
              {items.map((r) => {
                const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };
                return (
                  <tr key={r.id}>

                    {/* เลขที่จอง */}
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                      {r.reservation_no}
                    </td>

                    {/* สมาชิก */}
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.member_name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                        {r.member_phone ?? ''}
                      </p>
                    </td>

                    {/* สินค้า — ไม่แสดง LOT */}
                    <td>
                      <p style={{ margin: 0, fontWeight: 700 }}>
                        {displayProductName(r)}
                      </p>
                      {r.crop_type && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                          {r.crop_type}
                        </p>
                      )}
                      {r.supplier_name && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                          {r.supplier_name}
                        </p>
                      )}
                    </td>

                    {/* จำนวน */}
                    <td style={{ fontWeight: 700 }}>
                      {r.qty_reserved} {r.product_unit ?? 'ถุง'}
                      {r.qty_received != null && r.qty_received !== r.qty_reserved && (
                        <span style={{ display: 'block', fontSize: 12, color: '#1b5e20' }}>
                          จริง: {r.qty_received}
                        </span>
                      )}
                    </td>

                    {/* ยอด */}
                    <td style={{ fontWeight: 700, color: '#1b5e20' }}>
                      {r.total_amount.toLocaleString()} บาท
                    </td>

                    {/* วันนัดรับ */}
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {r.pickup_date
                        ? new Date(r.pickup_date).toLocaleDateString('th-TH', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* สถานะ */}
                    <td>
                      <span className={`status-badge status-badge--${st.badge}`}>
                        {st.label}
                      </span>
                    </td>

                    {/* การดำเนินการ */}
                    <td>
                      <div style={{
                        display: 'flex', gap: 4,
                        justifyContent: 'center', flexWrap: 'wrap',
                      }}>
                        {r.status === 'pending' && (
                          <button
                            className="admin-btn admin-btn--success"
                            onClick={() => doAction('confirm', r.id)}
                            disabled={acting !== null}
                            style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}
                          >
                            ✅ ยืนยัน
                          </button>
                        )}

                        {/* confirmed → ส่งไป POS แทน convert modal เดิม */}
                        {r.status === 'confirmed' && (
                          <button
                            className="admin-btn admin-btn--primary"
                            onClick={() => openInPos(r)}
                            style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}
                          >
                            🛒 เปิดใน POS
                          </button>
                        )}

                        {['pending', 'confirmed'].includes(r.status) && (
                          <button
                            className="admin-btn admin-btn--danger"
                            onClick={() => doAction('cancel', r.id)}
                            disabled={acting !== null}
                            style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}
                          >
                            ⛔
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
