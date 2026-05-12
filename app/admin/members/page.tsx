import { AdminMemberList } from '@/features/admin-members/admin-member-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminMembersPage() {
  return (
    <AdminWebShell title="สมาชิกทั้งหมด" subtitle="ค้นหา กรอง และจัดการสมาชิกในระบบ">
      <AdminMemberList />
    </AdminWebShell>
  );
}
