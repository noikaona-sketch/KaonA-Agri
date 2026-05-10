import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

export function ServiceTransportUIMock() {
  return (
    <>
      <SectionHeader title="Service / รถร่วม" subtitle="UI mock for service trip + vehicle provider flow" />

      <InfoCard
        title="รอบบริการเช้า"
        subtitle="แม่สรวย → โรงงาน | 06:30 น."
        meta={<StatusChip status="scheduled" />}
        action={<UIButton fullWidth>ดูรายละเอียดรอบรถ</UIButton>}
      />

      <FormSheet title="ผู้ให้บริการรถร่วม">
        <div className="service-mock__provider-list">
          <div className="service-mock__provider-card">
            <div className="service-mock__row">
              <p className="service-mock__name">สหกรณ์ขนส่งแม่สรวย</p>
              <StatusChip status="approved" />
            </div>
            <p className="service-mock__meta">ทะเบียน: กข-4580 เชียงราย · คนขับ: นายวิชัย</p>
          </div>
          <div className="service-mock__provider-card">
            <div className="service-mock__row">
              <p className="service-mock__name">ทีมรถชุมชนบ้านใหม่</p>
              <StatusChip status="under_review" />
            </div>
            <p className="service-mock__meta">ทะเบียน: บพ-9912 เชียงราย · คนขับ: นางสาวอรทัย</p>
          </div>
        </div>
      </FormSheet>

      <FormSheet title="ผู้โดยสารในรอบนี้">
        <div className="service-mock__list">
          <div className="service-mock__row"><p className="service-mock__name">สมชาย ใจดี</p><StatusChip status="approved" /></div>
          <div className="service-mock__row"><p className="service-mock__name">สุดา พานทอง</p><StatusChip status="under_review" /></div>
          <div className="service-mock__row"><p className="service-mock__name">นิรันดร์ ศรีสุข</p><StatusChip status="needs_update" /></div>
        </div>
      </FormSheet>

      <FormSheet title="Quick actions">
        <div className="service-mock__actions">
          <UIButton variant="secondary" fullWidth>เพิ่มผู้ให้บริการรถ</UIButton>
          <UIButton variant="ghost" fullWidth>สแกน QR ขึ้นรถ</UIButton>
          <UIButton variant="primary" fullWidth>ปิดรอบบริการ</UIButton>
        </div>
      </FormSheet>
    </>
  );
}
