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
  draft: 'ร่างเฉพาะในเครื่อง',
  submitted: 'รออนุมัติ',
  under_review: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  needs_update: 'ต้องแก้ไขข้อมูล',
  scheduled: 'วางแผนแล้ว',
  completed: 'เสร็จสิ้น',
};

export function StatusChip({ status }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${status}`} title={statusLabels[status]}>
      {statusLabels[status]}
    </span>
  );
}
