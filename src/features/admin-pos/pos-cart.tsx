'use client';

export type CartItem = {
  product_id: string;
  product_name: string;
  unit: string;
  qty: number;
  unit_price: number;
};

type PosCartProps = {
  items: CartItem[];
  member: { id: string; full_name: string } | null;
  orderType: 'sale' | 'reservation';
  paymentMethod: string;
  discount: string;
  pickupDate: string;
  submitting: boolean;
  onQtyChange: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onMemberChange: () => void;
  onOrderTypeChange: (t: 'sale' | 'reservation') => void;
  onPaymentChange: (v: string) => void;
  onDiscountChange: (v: string) => void;
  onPickupDateChange: (v: string) => void;
  onSubmit: () => void;
  notice: string | null;
};

export function PosCart({
  items, member, orderType, paymentMethod, discount, pickupDate,
  submitting, onQtyChange, onRemove, onMemberChange,
  onOrderTypeChange, onPaymentChange, onDiscountChange,
  onPickupDateChange, onSubmit, notice,
}: PosCartProps) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const discountAmt = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);
  const canSubmit = items.length > 0 && member !== null && !submitting;

  return (
    <div className="pos-cart">
      <div className="pos-cart__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>🛒 ตะกร้า ({items.length})</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['sale', 'reservation'] as const).map((t) => (
              <button key={t} onClick={() => onOrderTypeChange(t)}
                className={`admin-btn ${orderType === t ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
                style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }}>
                {t === 'sale' ? '💰 ขาย' : '📋 จอง'}
              </button>
            ))}
          </div>
        </div>
        <button className="admin-btn admin-btn--secondary" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }}
          onClick={onMemberChange}>
          {member ? `👤 ${member.full_name}` : '👤 เลือกสมาชิก…'}
        </button>
      </div>

      <div className="pos-cart__items">
        {items.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: 14 }}>
            กดสินค้าเพื่อเพิ่มลงตะกร้า
          </p>
        )}
        {items.map((item) => (
          <div key={item.product_id} className="pos-cart-item">
            <div className="pos-cart-item__name">
              <p style={{ margin: 0 }}>{item.product_name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.unit_price.toLocaleString()} บาท/{item.unit}</p>
            </div>
            <div className="pos-cart-item__qty">
              <button className="pos-qty-btn" onClick={() => onQtyChange(item.product_id, Math.max(0.1, item.qty - 1))}>−</button>
              <input className="pos-qty-input" type="number" min="0.1" step="0.1"
                value={item.qty} onChange={(e) => onQtyChange(item.product_id, Number(e.target.value))} />
              <button className="pos-qty-btn" onClick={() => onQtyChange(item.product_id, item.qty + 1)}>+</button>
            </div>
            <span className="pos-cart-item__price">{(item.qty * item.unit_price).toLocaleString()}</span>
            <button className="pos-cart-item__remove" onClick={() => onRemove(item.product_id)}>×</button>
          </div>
        ))}
      </div>

      <div className="pos-cart__footer">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label className="reg-label" style={{ fontSize: 12 }}>วิธีชำระ
            <select className="reg-input" style={{ fontSize: 13 }} value={paymentMethod} onChange={(e) => onPaymentChange(e.target.value)}>
              <option value="cash">💵 เงินสด</option>
              <option value="transfer">📱 โอน</option>
              <option value="debit_account">📒 ติดบัญชี</option>
              <option value="credit">💳 เครดิต</option>
            </select>
          </label>
          <label className="reg-label" style={{ fontSize: 12 }}>ส่วนลด (บาท)
            <input className="reg-input" type="number" min="0" style={{ fontSize: 13 }} value={discount} onChange={(e) => onDiscountChange(e.target.value)} placeholder="0" />
          </label>
        </div>

        {orderType === 'reservation' && (
          <label className="reg-label" style={{ fontSize: 12 }}>วันนัดรับ
            <input className="reg-input" type="date" style={{ fontSize: 13 }} value={pickupDate} onChange={(e) => onPickupDateChange(e.target.value)} />
          </label>
        )}

        <div style={{ borderTop: '1px dashed #e8ede8', paddingTop: 8, display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>ยอดรวม</span><span>{subtotal.toLocaleString()} บาท</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ef4444' }}>
              <span>ส่วนลด</span><span>−{discountAmt.toLocaleString()} บาท</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#1b5e20' }}>
            <span>รวมสุทธิ</span><span>{total.toLocaleString()} บาท</span>
          </div>
        </div>

        {notice && <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

        <button className="admin-btn admin-btn--success" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px', fontWeight: 800 }}
          onClick={onSubmit} disabled={!canSubmit}>
          {submitting ? 'กำลังดำเนินการ…' : orderType === 'sale' ? '💰 ชำระเงิน' : '📋 จอง'}
        </button>
      </div>
    </div>
  );
}
