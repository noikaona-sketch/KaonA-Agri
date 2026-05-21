'use client';

const BOOKING_STATUS_TH: Record<string, string> = {
  pending:   '⏳ รอยืนยัน',
  confirmed: '✅ ยืนยันแล้ว',
  completed: '🏁 เสร็จสิ้น',
  cancelled: '⛔ ยกเลิก',
};

export type BookingStatusRow = {
  id:                    string;
  expected_date_from:    string;
  expected_date_to:      string;
  estimated_tonnage:     number;
  estimated_moisture:    number | null;
  requires_dryer:        boolean;
  note:                  string | null;
  status:                string;
};

export function HarvestBookingStatusCard({ booking }: { booking: BookingStatusRow }) {
  return (
    <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>🌾 แจ้งเก็บเกี่ยวแล้ว</p>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        วันที่คาด:{' '}
        {new Date(booking.expected_date_from).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}
        {' '}ถึง{' '}
        {new Date(booking.expected_date_to).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        สถานะ: {BOOKING_STATUS_TH[booking.status] ?? booking.status}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
        ปริมาณคาดการณ์: {booking.estimated_tonnage.toLocaleString()} ตัน
      </p>
      {booking.estimated_moisture !== null && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
          ความชื้นโดยประมาณ: {booking.estimated_moisture}%
        </p>
      )}
      {booking.requires_dryer && (
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
          ต้องการอบลดความชื้น
        </p>
      )}
    </div>
  );
}
