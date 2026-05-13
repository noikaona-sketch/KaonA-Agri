import { AdminGroups } from '@/features/admin-groups/admin-groups';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminGroupsPage() {
  return (
    <AdminWebShell title="🗂️ จัดกลุ่มสมาชิก" subtitle="สร้างและจัดการกลุ่ม เพิ่ม-ลบสมาชิก">
      <AdminGroups />
    </AdminWebShell>
  );
}
