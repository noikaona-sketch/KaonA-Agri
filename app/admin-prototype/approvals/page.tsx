'use client';

import { ApprovalsQueueContent } from '@/features/registration-vertical-slice';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminApprovalsPage() {
  return (
    <AdminWebShell title="คิวอนุมัติคำขอบทบาท" subtitle="MVP/Local: อนุมัติคำขอจากข้อมูลในเครื่องนี้" roleBadge="แอดมิน">
      <ApprovalsQueueContent />
    </AdminWebShell>
  );
}
