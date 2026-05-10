'use client';

import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { EmptyState } from '@/shared/components/empty-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';

interface AppAreaPrototypeProps {
  areaHref: '/member' | '/service' | '/field' | '/admin-prototype';
}

const AREA_COPY: Record<AppAreaPrototypeProps['areaHref'], { title: string; subtitle: string; roleBadge: string }> = {
  '/member': {
    title: 'KaonA Member Prototype',
    subtitle: 'Member area mobile preview.',
    roleBadge: 'Member',
  },
  '/service': {
    title: 'KaonA Service Prototype',
    subtitle: 'Service area mobile preview.',
    roleBadge: 'Service',
  },
  '/field': {
    title: 'KaonA Field Prototype',
    subtitle: 'Field operations mobile preview.',
    roleBadge: 'Field',
  },
  '/admin-prototype': {
    title: 'KaonA Admin Prototype',
    subtitle: 'Admin prototype mobile preview.',
    roleBadge: 'Admin',
  },
};

export function AppAreaPrototype({ areaHref }: AppAreaPrototypeProps) {
  const area = AREA_COPY[areaHref];

  return (
    <MobileAppShell title={area.title} subtitle={area.subtitle} roleBadge={area.roleBadge}>
      <SectionHeader title="MVP forms" subtitle="Registration + field capture" action={<ProgressBadge current={4} total={4} />} />
      <InfoCard
        title="Shared UI preview"
        subtitle={`Display-only examples for ${areaHref}`}
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
  );
}
