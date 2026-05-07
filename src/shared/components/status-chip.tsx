type CanonicalStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_update'
  | 'scheduled'
  | 'completed';

type StatusChipProps = {
  status: CanonicalStatus;
};

const statusLabels: Record<CanonicalStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_update: 'Needs update',
  scheduled: 'Scheduled',
  completed: 'Completed',
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${status}`} title={statusLabels[status]}>
      {statusLabels[status]}
    </span>
  );
}
