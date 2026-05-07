import { InfoCard } from '@/shared/components/info-card';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

import { StatusTimeline } from './status-timeline';
import type { InspectionTaskRow } from './types';

const mapStatus = {
  pending: 'submitted',
  assigned: 'under_review',
  passed: 'approved',
  failed: 'rejected',
  needs_update: 'under_review',
  completed: 'approved',
} as const;

type TaskCardProps = {
  task: InspectionTaskRow;
  canUpdate: boolean;
  updating: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, status: InspectionTaskRow['result_status']) => void;
};

export function TaskCard({ task, canUpdate, updating, onSelect, onUpdate }: TaskCardProps) {
  return (
    <InfoCard
      title={`งานตรวจ ${task.id.slice(0, 8)}...`}
      subtitle={`มอบหมาย: ${task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '-'} | ตรวจจริง: ${task.visited_at ? new Date(task.visited_at).toLocaleString() : '-'}`}
      meta={<StatusChip status={mapStatus[task.result_status]} />}
      action={
        <>
          <UIButton fullWidth onClick={() => onSelect(task.id)}>เปิดรายละเอียด</UIButton>
          <StatusTimeline status={task.result_status} />
          {canUpdate ? (
            <>
              <UIButton fullWidth disabled={updating} onClick={() => onUpdate(task.id, 'passed')}>ผ่าน</UIButton>
              <UIButton fullWidth disabled={updating} onClick={() => onUpdate(task.id, 'failed')}>ไม่ผ่าน</UIButton>
              <UIButton fullWidth disabled={updating} onClick={() => onUpdate(task.id, 'needs_update')}>ให้แก้ไข</UIButton>
              <UIButton fullWidth disabled={updating} onClick={() => onUpdate(task.id, 'completed')}>ปิดงาน</UIButton>
            </>
          ) : null}
        </>
      }
    />
  );
}
