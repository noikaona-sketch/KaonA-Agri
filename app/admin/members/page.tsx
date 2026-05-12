'use client';

import { MemberApprovalQueue } from '@/features/member-approval-queue';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminMembersPage() {
  return (
    <AdminWebShell title="สมาชิก" subtitle="จัดการข้อมูลสมาชิกและสถานะการอนุมัติ" roleBadge="แอดมิน">
      <SectionHeader title="รายการสมาชิก" subtitle="หน้าหลังบ้านสำหรับตรวจสอบและจัดการสมาชิก" />
      <MemberApprovalQueue />
    </AdminWebShell>
  );
}
