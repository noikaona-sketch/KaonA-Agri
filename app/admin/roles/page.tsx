import { AdminRolesManager } from '@/features/admin-roles/admin-roles-manager';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminRolesPage() {
  return (
    <AdminWebShell title="จัดการ Role" subtitle="เพิ่มหรือลบสิทธิ์บทบาทของสมาชิก" roleBadge="แอดมิน">
      <AdminRolesManager />
    </AdminWebShell>
  );
}
