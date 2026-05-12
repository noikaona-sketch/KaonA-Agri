import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function NoBurnPage() {
  return (
    <ProtectedRoute>
      <NoBurnParticipationWorkflow />
    </ProtectedRoute>
  );
}
