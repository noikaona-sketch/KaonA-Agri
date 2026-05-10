import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type FieldTask = {
  id: string;
  memberName: string;
  village: string;
  time: string;
  status: 'scheduled' | 'under_review' | 'completed';
  noBurnStatus: 'ผ่านเกณฑ์' | 'ต้องติดตาม';
};

const assignedTasks: FieldTask[] = [
  { id: 'INS-2411', memberName: 'สมปอง อินทร์แก้ว', village: 'บ้านหนองแสง', time: '09:00', status: 'under_review', noBurnStatus: 'ผ่านเกณฑ์' },
  { id: 'INS-2412', memberName: 'มณีรัตน์ วงศ์ดี', village: 'บ้านโคกสำราญ', time: '11:30', status: 'scheduled', noBurnStatus: 'ต้องติดตาม' },
  { id: 'INS-2413', memberName: 'อำนวย ภูมี', village: 'บ้านดอนยาว', time: '14:00', status: 'completed', noBurnStatus: 'ผ่านเกณฑ์' },
];

export function FieldTeamUIMock() {
  return (
    <MobileAppShell title="ทีมภาคสนาม" subtitle="ต้นแบบหน้าทำงานตรวจแปลง" roleBadge="Field Team">
      <SectionHeader title="งานตรวจวันนี้" subtitle="วันอาทิตย์ 10 พฤษภาคม 2026" action={<ProgressBadge current={1} total={3} />} />

      <InfoCard
        title="สรุปงานประจำวัน"
        subtitle="รับมอบหมาย 3 งาน • เสร็จแล้ว 1 งาน • กำลังตรวจ 1 งาน"
        meta={<StatusChip status="under_review" />}
        action={<UIButton fullWidth>เริ่มงานถัดไป</UIButton>}
      />

      <SectionHeader title="รายการงานตรวจที่ได้รับมอบหมาย" subtitle="เรียงตามเวลานัดหมาย" />
      <section className="field-team-list">
        {assignedTasks.map((task) => (
          <article key={task.id} className="field-team-card">
            <div className="field-team-card__header">
              <p className="field-team-card__id">{task.id}</p>
              <StatusChip status={task.status} />
            </div>
            <h4 className="field-team-card__title">{task.memberName}</h4>
            <p className="field-team-card__meta">หมู่บ้าน: {task.village}</p>
            <p className="field-team-card__meta">เวลานัดหมาย: {task.time} น.</p>
            <p className="field-team-card__meta">สถานะตรวจไม่เผา: {task.noBurnStatus}</p>
            <div className="field-team-card__actions">
              <UIButton variant="ghost">ช่วยสมาชิก</UIButton>
              <UIButton variant="secondary">เปิดงานตรวจ</UIButton>
            </div>
          </article>
        ))}
      </section>

      <FormSheet title="checklist ตรวจแปลง">
        <ul className="field-team-checklist">
          <li>ตรวจข้อมูลสมาชิกและพิกัดแปลง</li>
          <li>ตรวจรูปถ่ายมุมกว้างของแปลง</li>
          <li>ยืนยันไม่มีร่องรอยการเผา</li>
        </ul>
      </FormSheet>

      <FormSheet title="GPS / รูปภาพ placeholder">
        <div className="field-team-placeholder">
          <p>พื้นที่สำหรับ GPS และรูปภาพหน้างาน (mock เท่านั้น)</p>
          <div className="field-team-placeholder__box">แผนที่/GPS</div>
          <div className="field-team-placeholder__box">รูปภาพหลักฐาน</div>
        </div>
      </FormSheet>
    </MobileAppShell>
  );
}
