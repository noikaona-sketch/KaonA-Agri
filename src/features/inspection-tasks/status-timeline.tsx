import type { InspectionResultStatus } from './types';

const orderedStatuses: InspectionResultStatus[] = ['pending', 'assigned', 'passed', 'failed', 'needs_update', 'completed'];

type StatusTimelineProps = {
  status: InspectionResultStatus;
};

export function StatusTimeline({ status }: StatusTimelineProps) {
  return <p>ไทม์ไลน์: {orderedStatuses.join(' → ')} | สถานะปัจจุบัน: {status}</p>;
}
