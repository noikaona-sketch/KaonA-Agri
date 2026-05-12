'use client';

import { AdminBackofficeDashboardMock } from '@/features/admin-backoffice-dashboard-mock';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminPrototypePage() {
  return (
    <AdminWebShell title="ศูนย์ปฏิบัติการ KaonA" subtitle="ต้นแบบหลังบ้านสำหรับแอดมิน" roleBadge="แอดมิน">
      <SectionHeader title="แดชบอร์ดหลังบ้าน" subtitle="ต้นแบบ UX สำหรับอนุมัติสมาชิก กำกับทีม และติดตาม KPI" />
      <AdminBackofficeDashboardMock />
    </AdminWebShell>
  );
}
