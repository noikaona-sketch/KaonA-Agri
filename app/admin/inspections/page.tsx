import { AdminInspectionsList } from '@/features/admin-inspections/admin-inspections-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🔍 งานตรวจแปลง" subtitle="ติดตามผลการตรวจแปลง">
      <AdminInspectionsList />
    </AdminWebShell>
  );
}
