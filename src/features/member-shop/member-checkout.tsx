'use client';

import { useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type CartItem = { product: { id: string; name: string; unit: string; price_per_unit: number; category: string }; qty: number };

type Props = {
  items: CartItem[];
  onBack: () => void;
  onSuccess: (orderId: string) => void;
};

const PAY_OPTIONS = [
  { value: 'debit_account', icon: '📒', label: 'ติดบัญชี', desc: 'ชำระภายหลัง ติดต่อ admin' },
  { value: 'transfer',      icon: '📱', label: 'โอนเงิน',  desc: 'โอนแล้วแจ้ง admin' },
  { value: 'cash',          icon: '💵', label: 'เงินสด',   desc: 'ชำระหน้าร้าน' },
];

export function MemberCheckout({ items, onBack, onSuccess }: Props) {
  const [payMethod, setPayMethod] = useState('debit_account');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const subtotal = items.reduce((s, i) => s + i.product.price_per_unit * i.qty, 0);
  const seedItems = items.filter((i) => i.product.category === 'seed');

  async function handleOrder() {
    setSubmitting(true); setError(null);
    const res = await fetch('/api/member/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({ product_id: i.product.id, qty: i.qty, unit_price: i.product.price_per_unit })),
        payment_method: payMethod,
        note,
        create_planting_cycles: seedItems.length > 0,
      }),
    });
    const payload = (await res.json()) as { ok?: boolean; order_id?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(payload.error ?? 'สั่งซื้อไม่สำเร็จ'); return; }
    onSuccess(payload.order_id ?? '');
  }

  return (
    <div className="mobile-stack">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 15, padding: 0, cursor: 'pointer', alignSelf: 'flex-start' }}>
        ← กลับ
      </button>

      <h2 style={{ margin: '0', fontSize: 20, fontWeight: 800 }}>สรุปคำสั่ง</h2>

      {/* รายการ */}
      <div className="kaona-card" style={{ padding: 0, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <div key={item.product.id} style={{ padding: '14px 16px', borderBottom: i < items.length - 1 ? '1px solid #f0f4f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{item.product.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{item.qty} {item.product.unit} × {item.product.price_per_unit.toLocaleString()} บาท</p>
            </div>
            <p style={{ margin: 0, fontWeight: 800, color: 'var(--primary)' }}>
              {(item.qty * item.product.price_per_unit).toLocaleString()}
            </p>
          </div>
        ))}
        <div style={{ padding: '14px 16px', background: '#f7faf7', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>รวมทั้งหมด</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--primary)' }}>{subtotal.toLocaleString()} บาท</span>
        </div>
      </div>

      {/* วิธีชำระ */}
      <div>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 15 }}>วิธีชำระเงิน</p>
        <div className="mobile-stack" style={{ gap: 8 }}>
          {PAY_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', background: payMethod === opt.value ? '#e8f5e9' : '#fff', border: `1.5px solid ${payMethod === opt.value ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s' }}>
              <input type="radio" checked={payMethod === opt.value} onChange={() => setPayMethod(opt.value)} style={{ accentColor: 'var(--primary)' }} />
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{opt.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* เมล็ดพันธุ์ hint */}
      {seedItems.length > 0 && (
        <div className="kaona-card" style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>🌱 สร้างวงจรการปลูกอัตโนมัติ</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4a6741', lineHeight: 1.6 }}>
            เมล็ดพันธุ์ {seedItems.length} รายการจะสร้างวงจรการปลูกให้อัตโนมัติ
            คุณสามารถระบุแปลงและวันปลูกได้ในภายหลัง
          </p>
        </div>
      )}

      <label className="reg-label">หมายเหตุ (ถ้ามี)
        <textarea className="reg-input reg-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ต้องการข้อมูลเพิ่มเติม…" />
      </label>

      {error && <div style={{ background: '#ffebee', borderRadius: 10, padding: '12px 16px', color: '#c62828', fontSize: 14 }}>⚠️ {error}</div>}

      <UIButton fullWidth onClick={handleOrder} loading={submitting} disabled={submitting}>
        ✅ ยืนยันคำสั่ง {subtotal.toLocaleString()} บาท
      </UIButton>
    </div>
  );
}
