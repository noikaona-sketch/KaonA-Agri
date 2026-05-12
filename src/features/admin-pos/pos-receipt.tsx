'use client';

import type { CartItem } from './pos-cart';

type ReceiptProps = {
  receipt: {
    order_number: string; total: number; subtotal: number; discount: number;
    paymentMethod: string;
    member: { full_name: string } | null;
    items: CartItem[];
  };
  onNew: () => void;
};

const PAY_TH: Record<string, string> = { cash: '💵 เงินสด', transfer: '📱 โอน', debit_account: '📒 ติดบัญชี', credit: '💳 เครดิต' };

export function PosReceipt({ receipt, onNew }: ReceiptProps) {
  const now = new Date().toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function printReceipt() { window.print(); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingBottom: 40 }}>
      <div style={{ background: '#e8f5e9', borderRadius: 16, padding: '16px 24px', textAlign: 'center', width: '100%', maxWidth: 400 }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: '#1b5e20' }}>ทำรายการสำเร็จ</p>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: '#4a6741' }}>{receipt.order_number}</p>
      </div>

      <div className="receipt" style={{ width: '100%', maxWidth: 360 }}>
        <div className="receipt__header">
          <p className="receipt__title">KaonA Agri</p>
          <p style={{ margin: '2px 0', fontSize: 12, color: '#6b7280' }}>{now}</p>
          <p style={{ margin: '2px 0', fontSize: 13, fontWeight: 600 }}>{receipt.order_number}</p>
        </div>
        <hr className="receipt__divider" />

        <div className="receipt__row" style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>ลูกค้า</span>
          <span>{receipt.member?.full_name ?? '—'}</span>
        </div>

        <hr className="receipt__divider" />

        {receipt.items.map((item) => (
          <div key={item.product_id}>
            <p style={{ margin: '4px 0 2px', fontSize: 13, fontWeight: 600 }}>{item.product_name}</p>
            <div className="receipt__row" style={{ color: '#6b7280' }}>
              <span>{item.qty} {item.unit} × {item.unit_price.toLocaleString()}</span>
              <span>{(item.qty * item.unit_price).toLocaleString()} บาท</span>
            </div>
          </div>
        ))}

        <hr className="receipt__divider" />

        <div className="receipt__row">
          <span>ยอดรวม</span>
          <span>{receipt.subtotal.toLocaleString()} บาท</span>
        </div>
        {receipt.discount > 0 && (
          <div className="receipt__row" style={{ color: '#ef4444' }}>
            <span>ส่วนลด</span>
            <span>−{receipt.discount.toLocaleString()} บาท</span>
          </div>
        )}
        <div className="receipt__row receipt__row--total">
          <span>รวมสุทธิ</span>
          <span>{receipt.total.toLocaleString()} บาท</span>
        </div>
        <div className="receipt__row receipt__row--paid">
          <span>ชำระ</span>
          <span>{PAY_TH[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
        </div>

        <hr className="receipt__divider" />
        <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', margin: 0 }}>ขอบคุณที่ใช้บริการ</p>
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
        <button className="admin-btn admin-btn--secondary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={printReceipt}>
          🖨️ พิมพ์
        </button>
        <button className="admin-btn admin-btn--primary" style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 15, fontWeight: 800 }} onClick={onNew}>
          ➕ รายการใหม่
        </button>
      </div>
    </div>
  );
}
