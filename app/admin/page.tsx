'use client';

import { AdminOperationalDashboard } from '@/features/admin-operational-dashboard';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminOperationalDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'staff']}>
      <AdminWebShell title="ศูนย์ปฏิบัติการแอดมิน" subtitle="พื้นที่ทำงานหลังบ้านสำหรับแอดมิน/เจ้าหน้าที่" roleBadge="แอดมิน/เจ้าหน้าที่">
        <SectionHeader title="ภาพรวมงานปฏิบัติการ" subtitle="สรุปคิวงานและสถานะสำหรับแอดมิน/เจ้าหน้าที่" />
        <AdminOperationalDashboard />
      </AdminWebShell>
    </ProtectedRoute>
  );
}
