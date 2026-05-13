'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type Reservation = {
  id: string; reservation_no: string; status: string;
  qty_reserved: number; qty_received: number | null;
  price_per_bag: number; total_amount: number;
  pickup_date: string | null; note: string | null;
  member_name: string; member_phone: string | null;
  variety_name: string; crop_type: string;
  supplier_name: string | null; lot_no: string; lot_balance: number;
  created_at: string; stock_deducted: boolean;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:   { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed: { badge: 'approved',  label: '✅ ยืนยัน' },
  completed: { badge: 'approved',  label: '🏁 รับแล้ว' },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก' },
};

const PAY_OPTIONS = [
  { value: 'debit_account', label: '📒 ติดบัญชี' },
  { value: 'cash',          label: '💵 เงินสด' },
  { value: 'transfer',      label: '📱 โอน' },
];

type ConvertModal = { reservation: Reservation; qtyActual: string; payMethod: string } | null;

export function AdminSeedReservations() {
  const [items, setItems]         = useState<Reservation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [acting, setActing]       = useState<string | null>(null);
  const [notice, setNotice]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [convertModal, setConvertModal] = useState<ConvertModal>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/seed-reservations${statusFilter ? `?status=${statusFilter}` : ''}`);
    const payload = (await res.json()) as { items?: Reservation[]; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function doAction(action: 'confirm' | 'cancel', id: string, reason?: string) {
    if (action === 'cancel' && !window.confirm('ยกเลิกการจองนี้?')) return;
    setActing(id); setNotice(null);
    const res = await fetch('/api/admin/seed-reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reservation_id: id, reason }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null);
    if (!res.ok) { setNotice(`❌ ${payload.error}`); return; }
    setNotice(action === 'confirm' ? '✅ ยืนยันแล้ว' : '⛔ ยกเลิกแล้ว');
    await load();
  }

  async function doConvert() {
    if (!convertModal) return;
    const qty = Number(convertModal.qtyActual);
    if (!qty || qty <= 0) { setNotice('❌ กรุณาระบุจำนวนจริง'); return; }
    setActing(convertModal.reservation.id); setNotice(null);
    const res = await fetch('/api/admin/seed-reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', reservation_id: convertModal.reservation.id, qty_actual: qty, payment_method: convertModal.payMethod }),
    });
    const payload = (await res.json()) as { ok?: boolean; order_number?: string; error?: string };
    setActing(null); setConvertModal(null);
    if (!res.ok) { setNotice(`❌ ${payload.error}`); return; }
    setNotice(`✅ รับสินค้าแล้ว — ${payload.order_number ?? ''}`);
    await load();
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      {pendingCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#e65100', fontSize: 14 }}>
          ⏳ รอยืนยัน {pendingCount} รายการ
        </div>
      )}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอยืนยัน</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="completed">🏁 รับแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>เลขที่</th><th>สมาชิก</th><th>พันธุ์ / LOT</th><th>จำนวน</th><th>ยอด</th><th>วันนัดรับ</th><th>สถานะ</th><th style={{ textAlign: 'center' }}>การดำเนินการ</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีรายการจอง</td></tr>}
              {items.map((r) => {
                const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.reservation_no}</td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.member_name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.member_phone ?? ''}</p>
                    </td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 700 }}>{r.variety_name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>LOT: {r.lot_no} · เหลือ {r.lot_balance} ถุง</p>
                      {r.supplier_name && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.supplier_name}</p>}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {r.qty_reserved} ถุง
                      {r.qty_received && r.qty_received !== r.qty_reserved && (
                        <span style={{ display: 'block', fontSize: 12, color: '#1b5e20' }}>จริง: {r.qty_received}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: '#1b5e20' }}>{r.total_amount.toLocaleString()} บาท</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {r.pickup_date ? new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {r.status === 'pending' && (
                          <button className="admin-btn admin-btn--success" onClick={() => doAction('confirm', r.id)} disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>✅ ยืนยัน</button>
                        )}
                        {r.status === 'confirmed' && (
                          <button className="admin-btn admin-btn--primary" onClick={() => setConvertModal({ reservation: r, qtyActual: String(r.qty_reserved), payMethod: 'debit_account' })} disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>📦 รับสินค้า</button>
                        )}
                        {['pending','confirmed'].includes(r.status) && (
                          <button className="admin-btn admin-btn--danger" onClick={() => doAction('cancel', r.id)} disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>⛔</button>
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

      {/* Convert Modal */}
      {convertModal && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConvertModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📦 บันทึกรับสินค้าจริง</h2>
              <button className="admin-modal__close" onClick={() => setConvertModal(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <div className="kaona-card" style={{ background: '#f1f8f1', marginBottom: 4 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{convertModal.reservation.variety_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>LOT {convertModal.reservation.lot_no} · {convertModal.reservation.reservation_no}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>จองไว้ {convertModal.reservation.qty_reserved} ถุง</p>
              </div>
              <label className="reg-label">จำนวนที่รับจริง (ถุง) <span className="reg-required">*</span>
                <input className="reg-input" type="number" min="0.1" step="0.1" value={convertModal.qtyActual} onChange={(e) => setConvertModal((p) => p ? { ...p, qtyActual: e.target.value } : p)} />
              </label>
              <label className="reg-label">วิธีชำระเงิน
                <select className="reg-input" value={convertModal.payMethod} onChange={(e) => setConvertModal((p) => p ? { ...p, payMethod: e.target.value } : p)}>
                  {PAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              {convertModal.qtyActual && (
                <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
                  💰 ยอด: {(Number(convertModal.qtyActual) * convertModal.reservation.price_per_bag).toLocaleString()} บาท
                </div>
              )}
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setConvertModal(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={doConvert} disabled={acting !== null}>
                {acting ? 'กำลังดำเนินการ…' : '✅ ยืนยันรับสินค้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
