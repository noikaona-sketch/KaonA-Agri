import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <MobileAppShell
        title="KaonA Agri"
        subtitle="Authenticated session ready for protected module implementation."
      />
    </ProtectedRoute>
  );
}
