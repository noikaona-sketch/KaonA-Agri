'use client';

import { UIButton } from '@/shared/components/ui-button';

const BOOKING_STATUS_TH: Record<string, string> = {
  planned: '🗓️ วางแผน',
  pending: '⏳ รอยืนยัน',
  confirmed: '✅ ยืนยันแล้ว',
  completed: '🏁 เสร็จสิ้น',
  cancelled: '⛔ ยกเลิก',
};

export type BookingStatusRow = {
  id: string;
  status: string;
  expected_date_from: string;
  expected_date_to: string;
  estimated_tonnage: number | null;
  estimated_moisture: number | null;
  requires_dryer: boolean | null;
  note?: string | null;
};

type Props = { booking: BookingStatusRow; onEdit?: () => void; onCancel?: () => void; busy?: boolean };

export function HarvestBookingStatusCard({ booking, onEdit, onCancel, busy = false }: Props) {
  const editable = ['planned', 'pending', 'confirmed'].includes(booking.status);
  return <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>🌾 แจ้งเก็บเกี่ยวแล้ว</p>
    <p style={{ margin: '0 0 4px', fontSize: 13 }}>ช่วงวันที่คาด: {booking.expected_date_from} ถึง {booking.expected_date_to}</p>
    <p style={{ margin: '0 0 4px', fontSize: 13 }}>สถานะ: {BOOKING_STATUS_TH[booking.status] ?? booking.status}</p>
    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>ปริมาณคาดการณ์: {booking.estimated_tonnage ?? '—'} ตัน</p>
    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>ความชื้นคาดการณ์: {booking.estimated_moisture ?? '—'}%</p>
    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ต้องการอบ: {booking.requires_dryer ? 'ต้องการ' : 'ไม่ต้องการ'}</p>
    {editable && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
      <UIButton type="button" onClick={onEdit} disabled={busy}>แก้ไขแผน</UIButton>
      <UIButton type="button" variant="ghost" onClick={onCancel} disabled={busy}>ยกเลิกแผน</UIButton>
    </div>}
    {booking.status === 'completed' && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280' }}>รายการที่เสร็จสิ้นแล้วไม่สามารถแก้ไขหรือยกเลิกได้</p>}
  </div>;
}
