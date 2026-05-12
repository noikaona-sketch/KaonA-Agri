import { AdminCreatePin } from '@/features/admin-invites/admin-create-pin';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminInvitesPage() {
  return (
    <AdminWebShell title="สร้าง PIN" subtitle="สร้าง PIN เพื่อเชิญสมาชิกเข้าร่วมระบบ" roleBadge="แอดมิน">
      <AdminCreatePin />
    </AdminWebShell>
  );
}
