import { FormSheet } from '@/shared/components/form-sheet';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { UIButton } from '@/shared/components/ui-button';

import type { InspectionTaskRow } from './types';

type TaskDetailProps = {
  task: InspectionTaskRow;
  note: string;
  submitting: boolean;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
};

export function TaskDetail({ task, note, submitting, onNoteChange, onSubmit }: TaskDetailProps) {
  return (
    <FormSheet title="รายละเอียดงานตรวจ">
      <p>รหัสงาน: {task.id}</p>
      <p>สถานะ: {task.result_status}</p>
      <label>ผลตรวจสั้นๆ
        <textarea rows={3} value={note} onChange={(e) => onNoteChange(e.target.value)} disabled={submitting} />
      </label>
      <UIButton fullWidth loading={submitting} disabled={submitting} onClick={onSubmit}>บันทึกผลตรวจ</UIButton>
      <PhotoUploadPlaceholder label="แนบรูปหลักฐาน + GPS" />
    </FormSheet>
  );
}
