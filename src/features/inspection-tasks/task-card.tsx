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
  onSelect: (id: string) => void;
  selected: boolean;
};

export function TaskCard({ task, onSelect, selected }: TaskCardProps) {
  return (
    <InfoCard
      title={`งานตรวจ ${task.id.slice(0, 8)}...`}
      subtitle={`มอบหมาย: ${task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '-'} | ลงพื้นที่: ${task.visited_at ? new Date(task.visited_at).toLocaleString() : 'ยังไม่ลงพื้นที่'}`}
      meta={<StatusChip status={mapStatus[task.result_status]} />}
      action={
        <>
          <UIButton fullWidth onClick={() => onSelect(task.id)}>{selected ? 'กำลังดูรายละเอียด' : 'เปิดรายละเอียด'}</UIButton>
          <StatusTimeline status={task.result_status} />
        </>
      }
    />
  );
}
