import { AdminServiceList } from '@/features/admin-service/admin-service-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🚜 บริการและการจอง" subtitle="จัดการการจองและมอบหมายงาน">
      <AdminServiceList />
    </AdminWebShell>
  );
}
