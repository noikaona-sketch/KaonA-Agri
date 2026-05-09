'use client';

import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';

function NoMemberFallback() {
  const { member } = useAuth();
  const lineUserId = member?.line_user_id ?? null;

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

export default function HomePage() {
  return (
    <ProtectedRoute fallbackNoMember={<NoMemberFallback />}>
      <MobileAppShell title="KaonA Agri" subtitle="Polished mobile baseline tuned for LINE in-app preview." roleBadge="Viewer">
        <SectionHeader title="MVP forms" subtitle="Registration + field capture" action={<ProgressBadge current={4} total={4} />} />
        <InfoCard
          title="Shared UI preview"
          subtitle="Display-only examples"
          meta={<StatusChip status="submitted" />}
          action={<UIButton fullWidth>Primary action</UIButton>}
        />
        <PlotRegistrationMVP />
        <NoBurnParticipationWorkflow />
        <FormSheet title="FormSheet">
          <StepList steps={[{ title: 'Step one', done: true }, { title: 'Step two' }]} />
          <PhotoUploadPlaceholder label="Field photo + GPS evidence foundation" />
        </FormSheet>
        <EmptyState title="EmptyState" detail="No items to show." />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
