'use client';

import { AdminOperationalDashboard } from '@/features/admin-operational-dashboard';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminOperationalDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'staff']}>
      <MobileAppShell title="KaonA Agri" subtitle="Admin / staff workspace" roleBadge="Admin/Staff">
        <SectionHeader title="Operations" subtitle="Operational queues and actions overview" />
        <AdminOperationalDashboard />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
