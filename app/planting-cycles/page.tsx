import { PlantingCycleManagementScreen } from '@/features/planting-cycle/planting-cycle-management-screen';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function PlantingCyclePage() {
  return (
    <ProtectedRoute>
      <PlantingCycleManagementScreen />
    </ProtectedRoute>
  );
}
