'use client';

import { MemberApprovalQueue } from '@/features/member-approval-queue';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminMembersPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'staff']}>
      <MobileAppShell title="KaonA Agri" subtitle="Admin / staff workspace" roleBadge="Admin/Staff">
        <SectionHeader title="Approvals" subtitle="Review pending member onboarding requests" />
        <MemberApprovalQueue />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
