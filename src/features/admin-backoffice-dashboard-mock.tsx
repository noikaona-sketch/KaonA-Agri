'use client';

import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';
import { PendingApprovalQueue } from '@/shared/pending-approval/pending-approval-queue';

const approvalAndRoleCards = [
  {
    title: 'อนุมัติสมาชิก',
    subtitle: 'รออนุมัติ 12 รายการ (KYC/เอกสารยังไม่ครบ 4 ราย)',
    status: 'under_review' as const,
    cta: 'เปิดคิวอนุมัติ',
  },
  {
    title: 'มอบหมายบทบาทผู้ใช้',
    subtitle: 'รออนุมัติผู้ให้บริการ 150 รายการ และจัดสิทธิ์ทีมภาคสนามใหม่',
    status: 'submitted' as const,
    cta: 'จัดการบทบาท',
  },
];

const operationsOverviewCards = [
  {
    title: 'สรุปการจัดการทีม',
    subtitle: 'ทีมงานพร้อมปฏิบัติการ 5 ทีม · งานค้างเกิน SLA 3 งาน',
    status: 'scheduled' as const,
    cta: 'ดูสรุปทีม',
  },
  {
    title: 'ภาพรวมปฏิบัติการภาคสนาม',
    subtitle: 'งานตรวจที่มอบหมาย 18 งาน · งานต้องติดตาม 5 งาน',
    status: 'under_review' as const,
    cta: 'ดูงานภาคสนาม',
  },
  {
    title: 'ภาพรวมโครงการเข้าร่วมไม่เผา',
    subtitle: 'คำขอใหม่ 14 รายการ · ผ่านตรวจแล้ว 36 รายการ',
    status: 'approved' as const,
    cta: 'ดูคำขอไม่เผา',
  },
];

const kpiCards = [
  { label: 'สมาชิกใช้งาน', value: '1,248' },
  { label: 'ผู้ตรวจแปลงที่มอบหมาย', value: '34' },
  { label: 'งานค้างดำเนินการ', value: '87' },
  { label: 'รอบเพาะปลูกปัจจุบัน', value: '9' },
];

const widgets = [
  'วิดเจ็ต: คิวอนุมัติด่วน (ภายใน 24 ชม.) 6 รายการ',
  'วิดเจ็ต: งานเสี่ยงไม่ผ่านตรวจวันนี้ 2 งาน',
  'วิดเจ็ต: แจ้งเตือนสมาชิกเอกสารหมดอายุ 11 บัญชี',
];

const recentActivity = [
  '09:45 · อนุมัติสมาชิก MBR-1024 โดยเจ้าหน้าที่สมชาย',
  '09:30 · งานตรวจ INS-542 ถูกยกระดับติดตาม (ข้อมูลหลักฐานไม่ครบ)',
  '09:10 · รับคำขอเข้าร่วมไม่เผา NBR-233 จากกลุ่มสหกรณ์หนองคาย',
  '08:40 · สร้างรอบเพาะปลูก 2026-ฤดูฝน โดยทีมแอดมิน',
];

export function AdminBackofficeDashboardMock() {
  return (
    <>
      <FormSheet
        title="แดชบอร์ดหลังบ้าน"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <UIButton variant="secondary">ส่งออกสรุปรายวัน</UIButton>
            <UIButton>แจ้งข่าวทีมงาน</UIButton>
          </div>
        }
      >
        <InfoCard
          title="สถานะปฏิบัติการรวม"
          subtitle="อัตราทำงานตาม SLA วันนี้ 91% · อัปเดตล่าสุด 10 พฤษภาคม 2026 เวลา 10:00 UTC"
          meta={<StatusChip status="approved" />}
          action={<ProgressBadge current={91} total={100} />}
        />

        {approvalAndRoleCards.map((card) => (
          <InfoCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            meta={<StatusChip status={card.status} />}
            action={<UIButton variant="ghost">{card.cta}</UIButton>}
          />
        ))}
      </FormSheet>

      <FormSheet title="ภาพรวมงานบริหารและภาคสนาม">
        {operationsOverviewCards.map((card) => (
          <InfoCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            meta={<StatusChip status={card.status} />}
            action={<UIButton variant="ghost">{card.cta}</UIButton>}
          />
        ))}
      </FormSheet>

      <FormSheet title="การ์ด KPI ผู้บริหาร (ข้อมูลจำลอง)">
        {kpiCards.map((kpi) => (
          <InfoCard key={kpi.label} title={kpi.label} subtitle={kpi.value} />
        ))}
      </FormSheet>

      <FormSheet title="วิดเจ็ตแดชบอร์ด">
        {widgets.map((widget) => (
          <p key={widget} style={{ marginBottom: 12 }}>
            {widget}
          </p>
        ))}
      </FormSheet>

      <FormSheet title="ความเคลื่อนไหวล่าสุด">
        {recentActivity.map((activity) => (
          <p key={activity} style={{ marginBottom: 12 }}>
            {activity}
          </p>
        ))}
      </FormSheet>

      <FormSheet title="คิวอนุมัติคำขอ (Issue #130 MVP)">
        <PendingApprovalQueue />
      </FormSheet>
    </>
  );
}
