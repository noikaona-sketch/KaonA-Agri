'use client';

import { AdminBackofficeDashboardMock } from '@/features/admin-backoffice-dashboard-mock';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminPrototypePage() {
  return (
    <MobileAppShell title="ศูนย์ปฏิบัติการ KaonA" subtitle="ต้นแบบหลังบ้านสำหรับแอดมิน" roleBadge="แอดมิน">
      <SectionHeader title="แดชบอร์ดหลังบ้าน" subtitle="ต้นแบบ UX สำหรับอนุมัติสมาชิก กำกับทีม และติดตาม KPI" />
      <AdminBackofficeDashboardMock />
    </MobileAppShell>
  );
}
