import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

const providers = [
  { type: 'รถไถ', owner: 'สมชาย ใจดี', freeSlot: 'ว่าง 13:00 - 16:00', pendingJobs: 2, factoryTrips: 0 },
  { type: 'รถเกี่ยว', owner: 'สุดา พานทอง', freeSlot: 'ว่าง 09:00 - 11:00', pendingJobs: 1, factoryTrips: 0 },
  { type: 'รถขนส่งผลผลิต', owner: 'นิรันดร์ ศรีสุข', freeSlot: 'ว่าง 15:30 - 18:00', pendingJobs: 3, factoryTrips: 4 },
];

export function ServiceTransportUIMock() {
  return (
    <>
      <SectionHeader title="ผู้ให้บริการการเกษตร" subtitle="ค้นหา จัดคิว และตอบรับงานบริการในพื้นที่" />

      <InfoCard
        title="สมัครเป็นผู้ตรวจแปลง"
        subtitle="เปิดรับผู้ให้บริการที่พร้อมตรวจและยืนยันสภาพแปลง"
        meta={<StatusChip status="submitted" />}
        action={<UIButton fullWidth>สมัครเป็นผู้ตรวจแปลง</UIButton>}
      />

      <FormSheet title="ตารางผู้ให้บริการ">
        <div className="service-mock__provider-list">
          {providers.map((provider) => (
            <div key={`${provider.type}-${provider.owner}`} className="service-mock__provider-card">
              <div className="service-mock__row">
                <p className="service-mock__name">{provider.type}</p>
                <StatusChip status="scheduled" />
              </div>
              <p className="service-mock__meta">ผู้ให้บริการ: {provider.owner}</p>
              <p className="service-mock__meta">ตารางว่าง: {provider.freeSlot}</p>
              <p className="service-mock__meta">งานรอรับ: {provider.pendingJobs}</p>
              <p className="service-mock__meta">จำนวนเที่ยวเข้าโรงงาน: {provider.factoryTrips}</p>
              <div className="service-mock__actions">
                <UIButton variant="primary" fullWidth>
                  รับงาน
                </UIButton>
                <UIButton variant="ghost" fullWidth>
                  ปฏิเสธ
                </UIButton>
              </div>
            </div>
          ))}
        </div>
      </FormSheet>
    </>
  );
}
