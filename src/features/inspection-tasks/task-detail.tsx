import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

import { StatusTimeline } from './status-timeline';
import type { InspectionTaskRow } from './types';

type TaskDetailProps = {
  task: InspectionTaskRow;
  gpsChecked: boolean;
  photoChecked: boolean;
  checklistChecked: boolean;
  submitted: boolean;
  resultDraft: string;
  onGpsToggle: () => void;
  onPhotoToggle: () => void;
  onChecklistToggle: () => void;
  onResultDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export function TaskDetail(props: TaskDetailProps) {
  const { task, gpsChecked, photoChecked, checklistChecked, submitted, resultDraft, onGpsToggle, onPhotoToggle, onChecklistToggle, onResultDraftChange, onSubmit } = props;
  const canSubmit = gpsChecked && photoChecked && checklistChecked && resultDraft.trim().length > 0;

  return (
    <FormSheet title="Inspection Detail (UI Prototype)">
      <p>รหัสงาน: {task.id}</p>
      <p>คำขอ no-burn: {task.no_burn_request_id ?? '-'}</p>
      <p>แปลง: {task.plot_id ?? '-'}</p>
      <StatusTimeline status={task.result_status} />

      <h4>1) GPS Placeholder</h4>
      <p>ตำแหน่ง: LAT 14.8820 / LNG 102.0160 (mock)</p>
      <UIButton fullWidth onClick={onGpsToggle}>{gpsChecked ? 'ยกเลิกยืนยัน GPS จำลอง' : 'ยืนยัน GPS จำลอง'}</UIButton>

      <h4>2) Photo Evidence Placeholder</h4>
      <p>รูปหลักฐาน: mock_01.jpg, mock_02.jpg</p>
      <UIButton fullWidth onClick={onPhotoToggle}>{photoChecked ? 'ยกเลิกแนบรูปจำลอง' : 'แนบรูปจำลองครบแล้ว'}</UIButton>

      <h4>3) Checklist (UI Only)</h4>
      <label>
        <input type="checkbox" checked={checklistChecked} onChange={onChecklistToggle} /> ตรวจจุดเสี่ยงการเผาและขอบเขตแปลงครบถ้วน
      </label>

      <h4>4) Submit Result (Draft)</h4>
      <textarea rows={3} value={resultDraft} onChange={(e) => onResultDraftChange(e.target.value)} placeholder="พิมพ์สรุปผลตรวจ (mock)" />
      <UIButton fullWidth disabled={!canSubmit} onClick={onSubmit}>ส่งผลตรวจ (UI Mock)</UIButton>

      {submitted ? <p>ส่งผลตรวจสำเร็จ (จำลอง) — ไม่มีการบันทึกฐานข้อมูล</p> : null}
    </FormSheet>
  );
}
