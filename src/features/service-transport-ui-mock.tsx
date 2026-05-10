import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

const providers = [
  {
    name: 'สหกรณ์ขนส่งแม่สรวย',
    status: 'approved' as const,
    detail: 'ทะเบียน: กข-4580 เชียงราย · คนขับ: นายวิชัย',
  },
  {
    name: 'ทีมรถชุมชนบ้านใหม่',
    status: 'under_review' as const,
    detail: 'ทะเบียน: บพ-9912 เชียงราย · คนขับ: นางสาวอรทัย',
  },
];

const passengers = [
  { name: 'สมชาย ใจดี', status: 'approved' as const },
  { name: 'สุดา พานทอง', status: 'under_review' as const },
  { name: 'นิรันดร์ ศรีสุข', status: 'needs_update' as const },
];

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
          {providers.map((provider) => (
            <div key={provider.name} className="service-mock__provider-card">
              <div className="service-mock__row">
                <p className="service-mock__name">{provider.name}</p>
                <StatusChip status={provider.status} />
              </div>
              <p className="service-mock__meta">{provider.detail}</p>
            </div>
          ))}
        </div>
      </FormSheet>

      <FormSheet title="ผู้โดยสารในรอบนี้">
        <div className="service-mock__list">
          {passengers.map((passenger) => (
            <div key={passenger.name} className="service-mock__row">
              <p className="service-mock__name">{passenger.name}</p>
              <StatusChip status={passenger.status} />
            </div>
          ))}
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
