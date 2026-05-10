import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

import { EvidenceUploader } from './evidence-uploader';
import { StatusTimeline } from './status-timeline';
import type { InspectionTaskRow } from './types';

type TaskDetailProps = {
  task: InspectionTaskRow;
  note: string;
  submitting: boolean;
  onNoteChange: (value: string) => void;
  onSubmit: (status: InspectionTaskRow['result_status']) => void;
  canUpdate: boolean;
};

export function TaskDetail({ task, note, submitting, onNoteChange, onSubmit, canUpdate }: TaskDetailProps) {
  return (
    <FormSheet title="รายละเอียดงานตรวจ">
      <p>รหัสงาน: {task.id}</p>
      <p>สถานะ: {task.result_status}</p>
      <StatusTimeline status={task.result_status} />
      <p>คำขอ no-burn: {task.no_burn_request_id ?? '-'}</p>
      <p>แปลง: {task.plot_id ?? '-'}</p>
      {task.result_note ? <p>ผลบันทึกล่าสุด: {task.result_note}</p> : null}
      {canUpdate ? (
        <>
          <label>ผลตรวจสั้นๆ
            <textarea rows={3} value={note} onChange={(e) => onNoteChange(e.target.value)} disabled={submitting} />
          </label>
          <UIButton fullWidth loading={submitting} disabled={submitting} onClick={() => onSubmit('passed')}>ผ่านการตรวจ</UIButton>
          <UIButton fullWidth loading={submitting} disabled={submitting} onClick={() => onSubmit('failed')}>ไม่ผ่านการตรวจ</UIButton>
          <UIButton fullWidth loading={submitting} disabled={submitting} onClick={() => onSubmit('needs_update')}>ให้แก้ไขและส่งใหม่</UIButton>
          <UIButton fullWidth loading={submitting} disabled={submitting} onClick={() => onSubmit('completed')}>ปิดงานตรวจ</UIButton>
          <EvidenceUploader inspectionId={task.id} />
        </>
      ) : (
        <p>โหมดอ่านอย่างเดียวสำหรับเกษตรกร: สามารถดูผลตรวจในขอบเขตของตนเองตามสิทธิ์ RLS เท่านั้น</p>
      )}
    </FormSheet>
  );
}
