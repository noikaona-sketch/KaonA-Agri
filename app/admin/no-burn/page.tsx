import { AdminNoBurnList } from '@/features/admin-no-burn/admin-no-burn-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🔥 คำของดเผา" subtitle="ตรวจสอบและอนุมัติ">
      <AdminNoBurnList />
    </AdminWebShell>
  );
}
