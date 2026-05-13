import { AppointmentsList } from '@/features/admin-appointments/appointments-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📅 นัดขายผลผลิต" subtitle="รายการนัดขาย ยืนยัน และบันทึกผล"><AppointmentsList /></AdminWebShell>;
}
