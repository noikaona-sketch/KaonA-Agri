 codex/create-ui-mock-for-service
import { ServiceTransportUIMock } from '@/features/service-transport-ui-mock';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function ServicePage() {
  return (
    <ProtectedRoute>
      <MobileAppShell
        title="Service / รถร่วม"
        subtitle="Mock screen for transportation coordination"
        roleBadge="Team leader"
      >
        <ServiceTransportUIMock />
      </MobileAppShell>
    </ProtectedRoute>
  );
}