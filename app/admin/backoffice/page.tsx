'use client';

import { AdminBackofficeDashboardMock } from '@/features/admin-backoffice-dashboard-mock';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminBackofficePage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'staff']}>
      <MobileAppShell title="KaonA Agri" subtitle="Back-office" roleBadge="Admin/Staff">
        <SectionHeader
          title="Admin back-office dashboard mock"
          subtitle="Operational overview for approvals, inspections, and cycle management"
        />
        <AdminBackofficeDashboardMock />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
