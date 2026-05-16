// src/features/member-shop/reservation-history-card.tsx

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '⏳ รอยืนยัน', color: '#e65100', bg: '#fff8e1' },
  confirmed: { label: '✅ ยืนยัน',   color: '#2e7d32', bg: '#e8f5e9' },
  completed: { label: '🏁 รับแล้ว',  color: '#1565c0', bg: '#e3f2fd' },
  converted: { label: '🛒 ขายแล้ว',  color: '#6a1b9a', bg: '#f3e5f5' },
  cancelled: { label: '⛔ ยกเลิก',   color: '#9e9e9e', bg: '#f5f5f5' },
};

export { STATUS_TH };

export type MyReservation = {
  id: string; reservation_no: string; status: string;
  qty_reserved: number; total_amount: number;
  pickup_date: string | null;
  variety_name: string;
  created_at: string;
};

export function ReservationHistoryCard({ r }: { r: MyReservation }) {
  const st = STATUS_TH[r.status] ?? { label: r.status, color: '#666', bg: '#f5f5f5' };
  return (
    <div className="kaona-card" style={{ background: st.bg, borderColor: st.color + '66' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{r.variety_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {r.reservation_no}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            {r.qty_reserved} ถุง — {r.total_amount.toLocaleString()} บาท
          </p>
          {r.pickup_date && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              นัดรับ {new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
          {st.label}
        </span>
      </div>
    </div>
  );
}
