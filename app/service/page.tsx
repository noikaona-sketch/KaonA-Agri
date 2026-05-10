import { ServiceTransportUIMock } from '@/features/service-transport-ui-mock';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServicePage() {
  return (
    <MobileAppShell
      title="ผู้ให้บริการ / รถร่วม"
      subtitle="จัดการคิวงาน รถ และบริการเกษตร"
      roleBadge="ผู้ให้บริการ"
    >
      <ServiceTransportUIMock />
    </MobileAppShell>
  );
}
