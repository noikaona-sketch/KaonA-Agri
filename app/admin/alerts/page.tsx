import { AdminAlertReadinessList } from '@/features/admin-alerts/admin-alert-readiness-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminAlertsPage() {
  return (
    <AdminWebShell title="Alert Readiness" subtitle="รายการความพร้อมแจ้งเตือน (ยังไม่ส่งจริง)">
      <AdminAlertReadinessList />
    </AdminWebShell>
  );
}
