'use client';
import { type CartItem } from './admin-pos';

type Reservation = { id: string; reservation_no: string; product_id: string | null; qty_reserved: number; variety_name: string; price_per_bag: number };

type Props = {
  mode: 'sale' | 'reservation';
  cart: CartItem[];
  memberReservations: Reservation[];
  reservationId: string | null;
  slots: { id: string; pickup_date: string; pickup_time: string; status: string; pickup_locations: { name: string; address: string | null } | null }[];
  selSlot: string;
  discount: string;
  payMethod: 'cash' | 'transfer' | 'credit';
  cashReceived: string;
  submitting: boolean;
  notice: string | null;
  subtotal: number; total: number; change: number; discountAmt: number;
  onUpdateQty: (key: string, qty: number) => void;
  onLoadReservation: (r: Reservation) => void;
  onSelSlot: (v: string) => void;
  onDiscount: (v: string) => void;
  onPayMethod: (v: 'cash' | 'transfer' | 'credit') => void;
  onCashReceived: (v: string) => void;
  onSubmit: () => void;
};

const MODE_COLOR = { sale: '#1b5e20', reservation: '#1565c0' };
const MODE_BG    = { sale: '#e8f5e9', reservation: '#e3f2fd' };

export function PosCartPanel(p: Props) {
  const { mode, cart, memberReservations, reservationId, slots, selSlot, discount, payMethod, cashReceived, submitting, notice, subtotal, total, change, discountAmt } = p;
  const color = MODE_COLOR[mode];
  const bg    = MODE_BG[mode];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: bg, borderRadius: 16, padding: 14, border: `2px solid ${color}40`, overflow: 'hidden', height: '100%' }}>

      {/* reservation cards */}
      {memberReservations.length > 0 && (
        <div style={{ borderRadius: 10, border: '1.5px solid #a5d6a7', background: '#fff', padding: '8px 10px', flexShrink: 0 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#1b5e20' }}>📋 รายการจองที่รอรับ</p>
          {memberReservations.map((r) => {
            const loaded = reservationId === r.id;
            return (
              <div key={r.id} onClick={() => !loaded && p.onLoadReservation(r)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: loaded ? '#c8e6c9' : '#f9f9f9', border: `1px solid ${loaded ? '#66bb6a' : '#e0e0e0'}`, cursor: loaded ? 'default' : 'pointer' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{r.variety_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{r.reservation_no} · {r.qty_reserved} ถุง · {r.price_per_bag.toLocaleString()} ฿/ถุง</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: loaded ? '#1b5e20' : '#1565c0', flexShrink: 0 }}>
                  {loaded ? '✅' : '📥 โหลด'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* cart items */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cart.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 16 }}>กดสินค้าเพื่อเพิ่มลงตะกร้า</p>}
        {cart.map((item) => (
          <div key={item.key} style={{ background: item.isReservedSeed ? '#c8e6c9' : '#fff', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${item.isReservedSeed ? '#66bb6a' : '#e0e0e0'}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{item.name}</p>
                {item.isReservedSeed && <span style={{ fontSize: 10, background: '#1b5e20', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>🔒 จอง</span>}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{item.unit_price.toLocaleString()} × {item.unit}</p>
            </div>
            {item.isReservedSeed ? (
              <span style={{ fontWeight: 900, minWidth: 28, textAlign: 'center', fontSize: 15, color: '#1b5e20' }}>{item.qty}</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button onClick={() => p.onUpdateQty(item.key, item.qty - 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e0e0e0', background: '#f5f5f5', cursor: 'pointer', fontWeight: 700 }}>−</button>
                <span style={{ fontWeight: 800, minWidth: 22, textAlign: 'center', fontSize: 13 }}>{item.qty}</span>
                <button onClick={() => p.onUpdateQty(item.key, item.qty + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${color}`, background: bg, cursor: 'pointer', color, fontWeight: 700 }}>+</button>
              </div>
            )}
            <p style={{ margin: 0, fontWeight: 900, fontSize: 13, minWidth: 64, textAlign: 'right', color }}>{(item.qty * item.unit_price).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {notice && <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', borderRadius: 8, padding: '8px 12px', color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{notice}</div>}

      {/* payment section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, borderTop: `1.5px solid ${color}40`, paddingTop: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
          <span>ยอดรวม</span><span>{subtotal.toLocaleString()} บาท</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>ส่วนลด (บาท)</span>
          <input value={discount} onChange={(e) => p.onDiscount(e.target.value)} type="number" min="0"
            style={{ width: 72, textAlign: 'right', padding: '3px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, color }}>
          <span>ชำระ</span><span>{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
        </div>

        {mode === 'reservation' && (
          <select value={selSlot} onChange={(e) => p.onSelSlot(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #90caf9', fontSize: 13 }}>
            <option value="">📅 ไม่ระบุรอบนัดรับ</option>
            {slots.map((sl) => {
              const loc = sl.pickup_locations;
              return <option key={sl.id} value={sl.id}>{sl.status === 'open' ? '🟢' : '🔴'} {new Date(sl.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {sl.pickup_time} · {loc?.name ?? ''}</option>;
            })}
          </select>
        )}

        <div style={{ display: 'flex', gap: 5 }}>
          {(['cash','transfer','credit'] as const).map((m) => (
            <button key={m} onClick={() => p.onPayMethod(m)}
              style={{ flex: 1, padding: '6px 2px', borderRadius: 8, border: `1.5px solid ${color}40`, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: payMethod === m ? color : '#fff', color: payMethod === m ? '#fff' : color }}>
              {m === 'cash' ? '💵 สด' : m === 'transfer' ? '🏦 โอน' : '📒 เครดิต'}
            </button>
          ))}
        </div>

        {payMethod === 'cash' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#6b7280' }}>รับเงิน</p>
              <input value={cashReceived} onChange={(e) => p.onCashReceived(e.target.value)} type="number"
                placeholder={total.toString()}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${color}`, fontSize: 16, fontWeight: 700 }} />
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {[total, Math.ceil(total/100)*100, Math.ceil(total/500)*500, Math.ceil(total/1000)*1000]
                  .filter((v,i,a) => a.indexOf(v)===i).slice(0,4)
                  .map((v) => <button key={v} onClick={() => p.onCashReceived(v.toString())} style={{ flex:1, padding:'3px 2px', borderRadius:6, border:`1px solid ${color}40`, background:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>{v.toLocaleString()}</button>)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#6b7280' }}>เงินทอน</p>
              <div style={{ padding: '7px 10px', borderRadius: 8, background: '#fff', border: `1.5px solid ${color}40`, fontSize: 16, fontWeight: 900, color, minHeight: 38, display: 'flex', alignItems: 'center' }}>
                {change.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        <button onClick={p.onSubmit} disabled={submitting || cart.length === 0}
          style={{ padding: '14px', borderRadius: 14, border: 'none', background: submitting || cart.length === 0 ? '#9ca3af' : color, color: '#fff', fontWeight: 800, fontSize: 16, cursor: submitting || cart.length === 0 ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'กำลังบันทึก…' : mode === 'sale'
            ? `💰 ขาย ${cart.reduce((s,c)=>s+c.qty,0)} รายการ`
            : `📋 จอง ${cart.reduce((s,c)=>s+c.qty,0)} รายการ`}
        </button>
      </div>
    </div>
  );
}
