import { AdminPlotsList } from '@/features/admin-plots/admin-plots-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🌾 แปลงเกษตร" subtitle="ดูและจัดการแปลงของสมาชิก">
      <AdminPlotsList />
    </AdminWebShell>
  );
}
