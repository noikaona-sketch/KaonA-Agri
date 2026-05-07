import { EmptyState } from '@/shared/components/empty-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StepList } from '@/shared/components/step-list';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <MobileAppShell
        title="KaonA Agri"
        subtitle="Shared mobile UI baseline ready for feature implementation."
        roleBadge="Viewer"
      >
        <SectionHeader
          title="Shared UI preview"
          subtitle="Reusable scaffold components"
          action={<ProgressBadge current={1} total={3} />}
        />
        <InfoCard
          title="Shared UI preview"
          subtitle="Display-only examples"
          meta={<StatusChip status="submitted" />}
          action={<UIButton fullWidth>Primary action</UIButton>}
        />
        <FormSheet title="FormSheet">
          <StepList steps={[{ title: 'Step one', done: true }, { title: 'Step two' }]} />
          <PhotoUploadPlaceholder />
        </FormSheet>
        <EmptyState title="EmptyState" detail="No items to show." />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
