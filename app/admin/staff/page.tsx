import { AdminStaffList } from '@/features/admin-staff/admin-staff-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminStaffPage() {
  return (
    <AdminWebShell title="เจ้าหน้าที่" subtitle="อนุมัติและจัดการบัญชีเจ้าหน้าที่หลังบ้าน">
      <AdminStaffList />
    </AdminWebShell>
  );
}
