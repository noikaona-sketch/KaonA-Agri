'use client';

import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

const queueCards = [
  {
    title: 'Member approvals',
    subtitle: '23 requests pending KYC and document checks',
    status: 'under_review' as const,
    cta: 'Open approval queue',
  },
  {
    title: 'No-burn participation requests',
    subtitle: '12 submissions waiting for staff validation',
    status: 'under_review' as const,
    cta: 'Review no-burn requests',
  },
  {
    title: 'Inspection escalations',
    subtitle: '5 plots flagged for failed evidence or GPS mismatch',
    status: 'rejected' as const,
    cta: 'Prioritize escalations',
  },
];

const kpiCards = [
  { label: 'Active members', value: '1,248' },
  { label: 'Assigned inspectors', value: '34' },
  { label: 'Open operational tasks', value: '87' },
  { label: 'Current planting cycles', value: '9' },
];

const activityFeed = [
  '09:45 · Staff Somchai approved member #MBR-1024',
  '09:30 · Inspection task INS-542 marked as failed (missing photo metadata)',
  '09:10 · No-burn request NBR-233 submitted from Nong Khai cooperative',
  '08:40 · New planting cycle 2026-Rainy drafted by admin team',
];

export function AdminBackofficeDashboardMock() {
  return (
    <>
      <FormSheet
        title="Back-office dashboard"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <UIButton variant="secondary">Export daily summary</UIButton>
            <UIButton>Broadcast staff update</UIButton>
          </div>
        }
      >
        <InfoCard
          title="Operations health"
          subtitle="Daily SLA compliance at 91% · last synced 10 May 2026, 10:00 UTC"
          meta={<StatusChip status="approved" />}
          action={<ProgressBadge current={91} total={100} />}
        />

        {queueCards.map((card) => (
          <InfoCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            meta={<StatusChip status={card.status} />}
            action={<UIButton variant="ghost">{card.cta}</UIButton>}
          />
        ))}
      </FormSheet>

      <FormSheet title="KPI snapshot (mock data)">
        {kpiCards.map((kpi) => (
          <InfoCard key={kpi.label} title={kpi.label} subtitle={kpi.value} />
        ))}
      </FormSheet>

      <FormSheet title="Live activity feed (mock)">
        {activityFeed.map((activity) => (
          <p key={activity} style={{ marginBottom: 12 }}>
            {activity}
          </p>
        ))}
      </FormSheet>
    </>
  );
}
