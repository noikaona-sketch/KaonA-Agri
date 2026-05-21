'use client';

import { UIButton } from '@/shared/components/ui-button';
import { DRYING_OPTIONS, DELIVERY_OPTIONS } from './harvest-booking-options';

const BOOKING_STATUS_TH: Record<string, string> = {
  pending:   '⏳ รอยืนยัน',
  confirmed: '✅ ยืนยันแล้ว',
  completed: '🏁 เสร็จสิ้น',
  cancelled: '⛔ ยกเลิก',
};

export type BookingStatusRow = {
  id:                    string;
  scheduled_date:        string;
  status:                string;
  drying_preference:     string | null;
  delivery_type:         string | null;
  estimated_moisture_pct: number | null;
  note?:                 string | null;
  actual_yield_kg?:      number | null;
};

type Props = {
  booking: BookingStatusRow;
  onEdit?: () => void;
  onCancel?: () => void;
  busy?: boolean;
};

export function HarvestBookingStatusCard({ booking, onEdit, onCancel, busy = false }: Props) {
  const editable = booking.status === 'pending' || booking.status === 'confirmed';

  return (
    <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>🌾 แจ้งเก็บเกี่ยวแล้ว</p>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        วันที่คาด:{' '}
        {new Date(booking.scheduled_date).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        สถานะ: {BOOKING_STATUS_TH[booking.status] ?? booking.status}
      </p>
      {booking.drying_preference && booking.drying_preference !== 'unknown' && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
          การอบ:{' '}
          {DRYING_OPTIONS.find((o) => o.value === booking.drying_preference)?.label}
        </p>
      )}
      {booking.delivery_type && booking.delivery_type !== 'unknown' && (
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
          การส่ง:{' '}
          {DELIVERY_OPTIONS.find((o) => o.value === booking.delivery_type)?.label}
        </p>
      )}
      {editable && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <UIButton type="button" onClick={onEdit} disabled={busy}>แก้ไขแผน</UIButton>
          <UIButton type="button" variant="ghost" onClick={onCancel} disabled={busy}>ยกเลิกแผน</UIButton>
        </div>
      )}
      {!editable && booking.status === 'completed' && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280' }}>รายการที่เสร็จสิ้นแล้วไม่สามารถแก้ไขหรือยกเลิกได้</p>
      )}
    </div>
  );
}
