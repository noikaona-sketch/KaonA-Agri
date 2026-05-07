'use client';

import { MemberApprovalQueue } from '@/features/member-approval-queue';
import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { PlantingCycleManagementScreen } from '@/features/planting-cycle/planting-cycle-management-screen';
import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { useAuth, useEffectiveRole } from '@/providers/auth-provider';
import type { AppRole } from '@/shared/auth/auth-types';
import { ErrorState } from '@/shared/components/error-state';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';

function resolveLineUserId(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null;

  const candidates = ['line_user_id', 'sub', 'provider_id', 'preferred_username']
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates[0] ?? null;
}

function NoMemberFallback() {
  const { session } = useAuth();

  if (!session) return null;

  const lineUserId = resolveLineUserId(session.user.user_metadata as Record<string, unknown> | undefined);

  if (!lineUserId) {
    return (
      <main className="mobile-shell">
        <ErrorState title="LINE identity is missing. Please reopen from LINE." />
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <MemberRegistrationMVP
        lineUserId={lineUserId}
        onSubmitted={async () => {
          window.location.reload();
        }}
      />
    </main>
  );
}

const roleHomeConfig: Record<AppRole, { title: string; subtitle: string; status: 'submitted' | 'under_review' | 'approved' }> = {
  admin: { title: 'Admin home', subtitle: 'System-wide visibility and approvals', status: 'approved' },
  staff: { title: 'Staff home', subtitle: 'Operational workflows and member support', status: 'approved' },
  inspector: { title: 'Inspector home', subtitle: 'Compliance and verification operations', status: 'under_review' },
  leader: { title: 'Leader home', subtitle: 'Farmer coordination and progress oversight', status: 'approved' },
  truck_owner: { title: 'Truck owner home', subtitle: 'Transport participation and logistics updates', status: 'submitted' },
  farmer: { title: 'Farmer home', subtitle: 'Field registration and planting cycle execution', status: 'approved' },
};

function RoleBasedHome() {
  const effectiveRole = useEffectiveRole();
  if (!effectiveRole) return <main className="mobile-shell"><ErrorState title="Unable to resolve role" detail="Please contact support to review your role assignment." /></main>;

  if (effectiveRole === 'farmer') return <PlantingCycleManagementScreen />;

  return (
    <MobileAppShell title="KaonA Agri" subtitle="Role-based home" roleBadge={effectiveRole}>
      <SectionHeader title={roleHomeConfig[effectiveRole].title} subtitle={roleHomeConfig[effectiveRole].subtitle} />
      <InfoCard
        title="Your access is active"
        subtitle="You can now continue to modules enabled for your role."
        meta={<StatusChip status={roleHomeConfig[effectiveRole].status} />}
      />
      {(effectiveRole === 'admin' || effectiveRole === 'staff') ? <MemberApprovalQueue /> : null}
      {(effectiveRole === 'leader' || effectiveRole === 'truck_owner') ? <NoBurnParticipationWorkflow /> : null}
      {effectiveRole === 'inspector' ? <PlotRegistrationMVP /> : null}
    </MobileAppShell>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute fallbackNoMember={<NoMemberFallback />}>
      <RoleBasedHome />
    </ProtectedRoute>
  );
}
