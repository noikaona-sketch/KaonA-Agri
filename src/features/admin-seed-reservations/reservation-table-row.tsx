// src/features/admin-seed-reservations/reservation-table-row.tsx
// ≤ 80 lines — single row component

import { useRouter } from 'next/navigation';

export type Reservation = {
  id: string; reservation_no: string; status: string;
  qty_reserved: number; qty_received: number | null;
  price_per_bag: number; total_amount: number;
  pickup_date: string | null; note: string | null;
  member_name: string; member_phone: string | null;
  product_id: string | null; product_name: string | null;
  product_unit: string | null;
  variety_name: string | null; crop_type: string | null;
  variety_name_snapshot: string | null; supplier_name: string | null;
  created_at: string; stock_deducted: boolean;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:   { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed: { badge: 'approved',  label: '✅ ยืนยัน'   },
  completed: { badge: 'approved',  label: '🏁 รับแล้ว'  },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก'   },
};

export function displayProductName(r: Reservation): string {
  return r.product_name ?? r.variety_name ?? r.variety_name_snapshot ?? '—';
}

type Props = {
  r: Reservation;
  acting: string | null;
  onAction: (action: 'confirm' | 'cancel', id: string) => void;
};

export function ReservationTableRow({ r, acting, onAction }: Props) {
  const router = useRouter();
  const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.reservation_no}</td>
      <td>
        <p style={{ margin: 0, fontWeight: 600 }}>{r.member_name}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.member_phone ?? ''}</p>
      </td>
      <td>
        <p style={{ margin: 0, fontWeight: 700 }}>{displayProductName(r)}</p>
        {r.crop_type    && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{r.crop_type}</p>}
        {r.supplier_name && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{r.supplier_name}</p>}
      </td>
      <td style={{ fontWeight: 700 }}>
        {r.qty_reserved} {r.product_unit ?? 'ถุง'}
        {r.qty_received != null && r.qty_received !== r.qty_reserved && (
          <span style={{ display: 'block', fontSize: 12, color: '#1b5e20' }}>จริง: {r.qty_received}</span>
        )}
      </td>
      <td style={{ fontWeight: 700, color: '#1b5e20' }}>{r.total_amount.toLocaleString()} บาท</td>
      <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {r.pickup_date
          ? new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—'}
      </td>
      <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
      <td>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
          {r.status === 'pending' && (
            <button className="admin-btn admin-btn--success" onClick={() => onAction('confirm', r.id)}
              disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>
              ✅ ยืนยัน
            </button>
          )}
          {r.status === 'confirmed' && (
            <button className="admin-btn admin-btn--primary"
              onClick={() => router.push(`/admin/pos?reservation_no=${encodeURIComponent(r.reservation_no)}`)}
              style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>
              🛒 เปิดใน POS
            </button>
          )}
          {['pending', 'confirmed'].includes(r.status) && (
            <button className="admin-btn admin-btn--danger" onClick={() => onAction('cancel', r.id)}
              disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>
              ⛔
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
