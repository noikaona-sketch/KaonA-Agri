'use client';
// Modal ให้พนักงานเลือกว่าจะปิดจองอย่างไร หลังขายจาก POS

import { useState } from 'react';

type Props = {
  reservation: {
    id: string; reservation_no: string;
    qty_reserved: number; variety_name: string | null; product_name: string | null;
  };
  saleOrderId?: string | null;
  qtySold?: number;
  onClose: () => void;
  onDone:  () => void;
};

export function ReservationCloseModal({ reservation, saleOrderId, qtySold, onClose, onDone }: Props) {
  const [choice,     setChoice]     = useState<'full' | 'partial' | null>(null);
  const [remaining,  setRemaining]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const name = reservation.product_name ?? reservation.variety_name ?? '—';

  async function submit() {
    if (!choice) return;
    if (choice === 'partial') {
      const rem = Number(remaining);
      if (!remaining || rem <= 0 || rem >= reservation.qty_reserved)
        return setError('กรอกจำนวนที่เหลือค้าง (ต้องน้อยกว่าจำนวนจอง)');
    }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/seed-reservations', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:         choice === 'full' ? 'close_full' : 'close_partial',
        reservation_id: reservation.id,
        sale_order_id:  saleOrderId ?? null,
        qty_sold:       qtySold ?? null,
        qty_remaining:  choice === 'partial' ? Number(remaining) : null,
      }),
    });
    const d = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) return setError(d.error ?? 'บันทึกไม่สำเร็จ');
    onDone();
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" style={{ maxWidth: 420 }}>
        <div className="admin-modal__header">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ปิดใบจอง — {reservation.reservation_no}</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', borderRadius: 8, padding: '8px 12px', color: '#c62828', fontSize: 13 }}>{error}</div>}

          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>{name}</strong> · จอง {reservation.qty_reserved} ถุง
            {qtySold != null && <> · ขายแล้ว <strong>{qtySold}</strong> ถุง</>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `2px solid ${choice === 'full' ? 'var(--primary)' : '#e0e0e0'}`, background: choice === 'full' ? '#e8f5e9' : '#fff', cursor: 'pointer' }}>
              <input type="radio" name="choice" value="full" checked={choice === 'full'} onChange={() => setChoice('full')} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>✅ ปิดจองสมบูรณ์</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ขายครบแล้ว หรือยกเลิกส่วนที่เหลือ</p>
              </div>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `2px solid ${choice === 'partial' ? '#1565c0' : '#e0e0e0'}`, background: choice === 'partial' ? '#e3f2fd' : '#fff', cursor: 'pointer' }}>
              <input type="radio" name="choice" value="partial" checked={choice === 'partial'} onChange={() => setChoice('partial')} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>⏳ ค้างไว้ (ของยังไม่ครบ)</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>จองยังเปิดอยู่ บันทึกจำนวนที่เหลือ</p>
                {choice === 'partial' && (
                  <label className="reg-label" style={{ marginTop: 8, fontSize: 13 }}>จำนวนที่เหลือค้าง (ถุง) <span className="reg-required">*</span>
                    <input className="reg-input" type="number" min="1" value={remaining}
                      onChange={(e) => setRemaining(e.target.value)} placeholder="เช่น 4" />
                  </label>
                )}
              </div>
            </label>
          </div>
        </div>
        <div className="admin-modal__footer">
          <button className="admin-btn admin-btn--secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="admin-btn admin-btn--primary" onClick={submit} disabled={saving || !choice}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
