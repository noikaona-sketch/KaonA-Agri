import Link from 'next/link';
import { AppointmentDetail } from '@/features/admin-appointments/appointment-detail';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
type Props = { params: { id: string } };
export default function Page({ params }: Props) {
  return (
    <AdminWebShell title="📋 รายละเอียดนัดขาย" subtitle="บันทึกผลการขายและตรวจสอบคุณภาพ">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/appointments" className="admin-btn admin-btn--secondary">← กลับ</Link>
      </div>
      <AppointmentDetail appointmentId={params.id} />
    </AdminWebShell>
  );
}
