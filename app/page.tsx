import { ProtectedRouteState } from '@/shared/components/protected-route-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function HomePage() {
  return (
    <ProtectedRouteState>
      <MobileAppShell
        title="KaonA Agri"
        subtitle="Authenticated session ready for protected module implementation."
      />
    </ProtectedRouteState>
  );
}
