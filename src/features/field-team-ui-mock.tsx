import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type InspectionCard = {
  id: string;
  farmer: string;
  plotCode: string;
  village: string;
  appointment: string;
  status: 'scheduled' | 'under_review' | 'completed';
  checklistDone: number;
  checklistTotal: number;
  evidenceCount: number;
};

const inspectionQueue: InspectionCard[] = [
  {
    id: 'INS-2407',
    farmer: 'ประกิจ บุญเรือง',
    plotCode: 'PLT-0172',
    village: 'บ้านหนองบัว',
    appointment: '09:15',
    status: 'under_review',
    checklistDone: 4,
    checklistTotal: 6,
    evidenceCount: 3,
  },
  {
    id: 'INS-2408',
    farmer: 'สมฤดี ทองสุข',
    plotCode: 'PLT-0191',
    village: 'บ้านโคกสูง',
    appointment: '11:40',
    status: 'scheduled',
    checklistDone: 0,
    checklistTotal: 6,
    evidenceCount: 0,
  },
  {
    id: 'INS-2409',
    farmer: 'ศุภชัย เพียรดี',
    plotCode: 'PLT-0204',
    village: 'บ้านดอนกลาง',
    appointment: '14:10',
    status: 'completed',
    checklistDone: 6,
    checklistTotal: 6,
    evidenceCount: 5,
  },
];

export function FieldTeamUIMock() {
  return (
    <MobileAppShell title="Field Inspection" subtitle="UI mock ทีมภาคสนามสำหรับงานตรวจแปลง" roleBadge="Staff">
      <SectionHeader
        title="Inspection Queue"
        subtitle="10 พ.ค. 2026 • เขตอำเภอเมือง"
        action={<ProgressBadge current={1} total={3} />}
      />

      <article className="field-team-summary">
        <p className="field-team-summary__label">Live team status</p>
        <h3 className="field-team-summary__title">กำลังตรวจแปลง INS-2407</h3>
        <p className="field-team-summary__meta">ผู้ตรวจ: พนง.ชลธิชา • ETA ถัดไป 11:40 • พิกัดพร้อมใช้งาน</p>
        <div className="field-team-summary__actions">
          <UIButton>เปิดแผนที่งานถัดไป</UIButton>
          <UIButton variant="secondary">เริ่มบันทึกหลักฐาน</UIButton>
        </div>
      </article>

      <section className="field-team-kpi-grid" aria-label="inspection metrics">
        <article className="field-team-kpi-card">
          <p className="field-team-kpi-card__label">Checklist ผ่าน</p>
          <p className="field-team-kpi-card__value">11/18</p>
        </article>
        <article className="field-team-kpi-card">
          <p className="field-team-kpi-card__label">รูปหลักฐาน</p>
          <p className="field-team-kpi-card__value">8 ภาพ</p>
        </article>
        <article className="field-team-kpi-card">
          <p className="field-team-kpi-card__label">งานเสี่ยง</p>
          <p className="field-team-kpi-card__value field-team-kpi-card__value--warn">1 รายการ</p>
        </article>
      </section>

      <section className="field-team-list">
        {inspectionQueue.map((item) => (
          <article key={item.id} className="field-team-card">
            <div className="field-team-card__header">
              <p className="field-team-card__id">{item.id}</p>
              <StatusChip status={item.status} />
            </div>
            <h4 className="field-team-card__title">{item.plotCode} • {item.farmer}</h4>
            <p className="field-team-card__meta">หมู่บ้าน: {item.village}</p>
            <p className="field-team-card__meta">เวลานัดหมาย: {item.appointment} น.</p>
            <p className="field-team-card__meta">Checklist: {item.checklistDone}/{item.checklistTotal} • หลักฐานภาพ: {item.evidenceCount}</p>
            <div className="field-team-card__actions">
              <UIButton variant="ghost">ดู checklist</UIButton>
              <UIButton variant="secondary">บันทึกผลตรวจ</UIButton>
            </div>
          </article>
        ))}
      </section>
    </MobileAppShell>
  );
}
