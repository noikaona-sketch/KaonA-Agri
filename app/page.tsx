import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

export default function HomePage() {
  return (
    <MobileAppShell
      title="KaonA Agri"
      subtitle="Shared mobile UI baseline ready for feature implementation."
      roleBadge="Farmer"
    >
      <InfoCard
        title="No-burn evidence"
        subtitle="Last updated: May 6, 2026"
        meta={<StatusChip status="submitted" />}
        action={
          <UIButton variant="primary" fullWidth>
            Submit update
          </UIButton>
        }
      />
    </MobileAppShell>
  );
}
