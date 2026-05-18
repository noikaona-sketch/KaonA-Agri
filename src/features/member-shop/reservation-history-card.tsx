// src/features/member-shop/reservation-history-card.tsx

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '⏳ รอยืนยัน', color: '#e65100', bg: '#fff8e1' },
  confirmed: { label: '✅ ยืนยัน',   color: '#2e7d32', bg: '#e8f5e9' },
  completed: { label: '🏁 รับแล้ว',  color: '#1565c0', bg: '#e3f2fd' },
  converted: { label: '🛒 ขายแล้ว',  color: '#6a1b9a', bg: '#f3e5f5' },
  cancelled: { label: '⛔ ยกเลิก',   color: '#9e9e9e', bg: '#f5f5f5' },
};

export { STATUS_TH };

// Source labels — distinguish card type per requirement
const SOURCE_LABEL: Record<string, { icon: string; label: string; color: string }> = {
  seed_reservation:      { icon: '🌾', label: 'จองเมล็ดพันธุ์',  color: '#2e7d32' },
  sale_order_reservation:{ icon: '📋', label: 'จองสินค้า',        color: '#1565c0' },
  sale_order_sale:       { icon: '🛒', label: 'คำสั่งซื้อสินค้า', color: '#6a1b9a' },
};

export type OrderItem = {
  product_name: string;
  qty:          number;
  unit_price:   number;
  product_unit: string;
};

export type MyReservation = {
  id:             string;
  reservation_no: string;
  status:         string;
  qty_reserved:   number;
  total_amount:   number;
  price_per_bag?: number;
  pickup_date:    string | null;
  variety_name:   string;
  created_at:     string;
  order_items?:   OrderItem[] | null;
  _source?:       'seed_reservation' | 'sale_order_reservation' | 'sale_order_sale';
};

export function ReservationHistoryCard({ r }: { r: MyReservation }) {
  const st  = STATUS_TH[r.status] ?? { label: r.status, color: '#666', bg: '#f5f5f5' };
  const src = SOURCE_LABEL[r._source ?? 'seed_reservation'];
  const hasItems = Array.isArray(r.order_items) && r.order_items.length > 0;
  // For sale_orders with multiple items, prefer the items list over variety_name headline
  const isSaleOrder = r._source === 'sale_order_sale' || r._source === 'sale_order_reservation';

  return (
    <div className="kaona-card" style={{ background: st.bg, borderColor: st.color + '66' }}>

      {/* Header row: source badge + status badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: '3px 9px', borderRadius: 999,
          background: src.color + '18', color: src.color,
        }}>
          {src.icon} {src.label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: '3px 9px', borderRadius: 999,
          background: st.color + '22', color: st.color,
          whiteSpace: 'nowrap',
        }}>
          {st.label}
        </span>
      </div>

      {/* Reference number */}
      <p style={{ margin: '0 0 4px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
        {r.reservation_no}
      </p>

      {/* Headline: variety_name for seed reservations; first item or order summary for sale_orders */}
      {!isSaleOrder && (
        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15 }}>
          {r.variety_name}
        </p>
      )}

      {/* Order items list (for sale_order rows) */}
      {hasItems && (
        <div style={{ marginBottom: 8 }}>
          {(r.order_items as OrderItem[]).map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '5px 0',
                borderBottom: i < (r.order_items as OrderItem[]).length - 1
                  ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <span style={{ fontSize: 13, flex: 1 }}>{item.product_name}</span>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', marginLeft: 8 }}>
                {item.qty} {item.product_unit}
                {' · '}
                {(item.qty * item.unit_price).toLocaleString()} บาท
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Qty + total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!isSaleOrder && r.qty_reserved > 0 && (
          <p style={{ margin: 0, fontSize: 13 }}>
            {r.qty_reserved} ถุง
          </p>
        )}
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1b5e20' }}>
          {r.total_amount.toLocaleString()} บาท
        </p>
      </div>

      {/* Pickup date */}
      {r.pickup_date && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
          📅 นัดรับ {new Date(r.pickup_date).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      )}

      {/* Created at */}
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
        {new Date(r.created_at).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </p>
    </div>
  );
}
