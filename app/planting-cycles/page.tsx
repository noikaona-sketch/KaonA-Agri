import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PlantingCycleList } from '@/features/member-planting/planting-cycle-list';

export default function PlantingCyclesPage() {
  return (
    <MobileAppShell title="รอบเพาะปลูก" subtitle="ติดตามการเพาะปลูกทุกแปลง">
      <PlantingCycleList />
    </MobileAppShell>
  );
}
