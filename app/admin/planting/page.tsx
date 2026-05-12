import { AdminPlantingList } from '@/features/admin-planting/admin-planting-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🌱 รอบเพาะปลูก" subtitle="ติดตามการเพาะปลูก">
      <AdminPlantingList />
    </AdminWebShell>
  );
}
