import { PlotRegistrationScreen } from '@/features/plot-registration/plot-registration-screen';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function PlotPage() {
  return (
    <ProtectedRoute>
      <PlotRegistrationScreen />
    </ProtectedRoute>
  );
}
