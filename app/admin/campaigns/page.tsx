import { AdminCampaignsManager } from '@/features/admin-campaigns/admin-campaigns-manager';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminCampaignsPage() {
  return (
    <AdminWebShell title="Campaign / Announcement" subtitle="สร้างและจัดการประกาศให้สมาชิกเห็นหน้าแรก">
      <AdminCampaignsManager />
    </AdminWebShell>
  );
}
