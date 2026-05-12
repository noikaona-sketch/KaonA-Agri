import { AdminAppointmentsList } from '@/features/admin-appointments/admin-appointments-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📅 นัดขายผลผลิต" subtitle="จัดการนัดหมายขายข้าวโพดและผลผลิต"><AdminAppointmentsList /></AdminWebShell>;
}
