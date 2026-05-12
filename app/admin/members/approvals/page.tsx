import { AdminApprovalQueue } from '@/features/admin-members/admin-approval-queue';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminApprovalsPage() {
  return (
    <AdminWebShell title="คิวอนุมัติสมาชิก" subtitle="อนุมัติหรือปฏิเสธคำขอสมัครสมาชิกที่รออยู่">
      <AdminApprovalQueue />
    </AdminWebShell>
  );
}
