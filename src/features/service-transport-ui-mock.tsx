import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

const bookingSteps = [
  { label: '1) เลือกบริการ', detail: 'ไถพรวน / หว่านปุ๋ย / รถขนส่ง' },
  { label: '2) ระบุเวลาและแปลง', detail: 'เลือกวัน เวลา และพิกัดแปลงที่ต้องการ' },
  { label: '3) ยืนยันคำขอ', detail: 'ส่งคำขอและติดตามสถานะผ่านเลขงาน' },
];

const bookingQueue = [
  {
    id: 'BK-240510-014',
    service: 'รถไถเตรียมดิน',
    member: 'นางสาวมาลี พรมทอง',
    slot: '10 พ.ค. 2026 • 13:00 - 16:00',
    plot: 'แปลง A-12 (บ้านหนองบัว)',
    status: 'under_review' as const,
    cta: 'ยืนยันรับงาน',
  },
  {
    id: 'BK-240510-011',
    service: 'รถขนส่งผลผลิต',
    member: 'นายสมพงษ์ ศรีแสง',
    slot: '10 พ.ค. 2026 • 16:30 - 18:30',
    plot: 'แปลง C-03 (บ้านดอนแก้ว)',
    status: 'scheduled' as const,
    cta: 'ดูรายละเอียดคิว',
  },
];

const activeJobs = [
  {
    id: 'JOB-240509-008',
    service: 'รถเกี่ยวข้าว',
    progress: 'กำลังเดินทางไปแปลง',
    eta: 'คาดถึง 25 นาที',
    contact: 'หัวหน้าทีม: วิทยา 08x-xxx-2244',
  },
];

export function ServiceTransportUIMock() {
  return (
    <>
      <SectionHeader title="Service Booking UX Flow" subtitle="ต้นแบบหน้าจอการจองบริการ (UI เท่านั้น)" />

      <InfoCard
        title="Flow ภาพรวม"
        subtitle="ผู้ใช้เลือกบริการ → ระบุเวลา/แปลง → ส่งคำขอ → ผู้ให้บริการตอบรับ"
        meta={<StatusChip status="submitted" />}
      />

      <FormSheet title="ขั้นตอนการจองสำหรับสมาชิก">
        <ol className="service-booking__steps">
          {bookingSteps.map((step) => (
            <li key={step.label} className="service-booking__step-item">
              <p className="service-booking__step-label">{step.label}</p>
              <p className="service-booking__step-detail">{step.detail}</p>
            </li>
          ))}
        </ol>
        <div className="service-booking__actions">
          <UIButton fullWidth>เริ่มจองบริการ</UIButton>
          <UIButton variant="ghost" fullWidth>
            ดูประวัติการจอง
          </UIButton>
        </div>
      </FormSheet>

      <FormSheet title="คำขอรอผู้ให้บริการตอบรับ">
        <div className="service-booking__card-list">
          {bookingQueue.map((item) => (
            <article key={item.id} className="service-booking__card">
              <div className="service-booking__row">
                <p className="service-booking__id">{item.id}</p>
                <StatusChip status={item.status} />
              </div>
              <p className="service-booking__service">{item.service}</p>
              <p className="service-booking__meta">สมาชิก: {item.member}</p>
              <p className="service-booking__meta">เวลา: {item.slot}</p>
              <p className="service-booking__meta">แปลง: {item.plot}</p>
              <div className="service-booking__actions service-booking__actions--inline">
                <UIButton variant="primary" fullWidth>
                  {item.cta}
                </UIButton>
                <UIButton variant="ghost" fullWidth>
                  ขอเลื่อนเวลา
                </UIButton>
              </div>
            </article>
          ))}
        </div>
      </FormSheet>

      <FormSheet title="งานที่กำลังให้บริการ">
        <div className="service-booking__card-list">
          {activeJobs.map((job) => (
            <article key={job.id} className="service-booking__card">
              <div className="service-booking__row">
                <p className="service-booking__id">{job.id}</p>
                <StatusChip status="scheduled" />
              </div>
              <p className="service-booking__service">{job.service}</p>
              <p className="service-booking__meta">สถานะ: {job.progress}</p>
              <p className="service-booking__meta">{job.eta}</p>
              <p className="service-booking__meta">{job.contact}</p>
              <UIButton fullWidth>อัปเดตหน้างาน</UIButton>
            </article>
          ))}
        </div>
      </FormSheet>
    </>
  );
}
