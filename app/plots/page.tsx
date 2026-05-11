import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function PlotPage() {
  return (
    <ProtectedRoute>
      <PlotRegistrationMVP />
    </ProtectedRoute>
  );
}
