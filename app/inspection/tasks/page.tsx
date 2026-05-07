import { InspectionTaskWorkflow } from '@/features/inspection-task-workflow';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function InspectionTasksPage() {
  return (
    <ProtectedRoute>
      <InspectionTaskWorkflow />
    </ProtectedRoute>
  );
}
