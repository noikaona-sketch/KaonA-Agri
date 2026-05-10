import { ServiceTransportUIMock } from '@/features/service-transport-ui-mock';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function ServicePage() {
  return (
    <ProtectedRoute>
      <MobileAppShell
        title="Service / รถร่วม"
        subtitle="Issue #88 mock screen for transportation coordination"
        roleBadge="Team leader"
        activeTab="Service"
      >
        <ServiceTransportUIMock />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
