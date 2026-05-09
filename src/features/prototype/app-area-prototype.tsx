import Link from 'next/link';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type PrototypeStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'scheduled';

type PrototypeKpi = {
  label: string;
  value: string;
  detail: string;
};

type PrototypeWorkflow = {
  title: string;
  detail: string;
  status: PrototypeStatus;
};

type PrototypeArea = {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  roleBadge: string;
  progressCurrent: number;
  progressTotal: number;
  kpis: PrototypeKpi[];
  workflows: PrototypeWorkflow[];
  nextActions: string[];
};

const AREAS: PrototypeArea[] = [
  {
    href: '/member',
    label: 'สมาชิก',
    title: 'สมาชิกเกษตรกร',
    subtitle: 'สมัครสมาชิก จัดการแปลง จองเมล็ดพันธุ์ นัดขาย และเข้าร่วมโครงการไม่เผา',
    roleBadge: 'Farmer',
    progressCurrent: 5,
    progressTotal: 9,
    kpis: [
      { label: 'แปลง', value: '3', detail: 'ตัวอย่างแปลงที่ขึ้นทะเบียน' },
      { label: 'รอบปลูก', value: '2', detail: 'กำลังวางแผน/รอเก็บเกี่ยว' },
      { label: 'ไม่เผา', value: '1', detail: 'คำขอรอตรวจภาคสนาม' },
    ],
    workflows: [
      { title: 'ข้อมูลสมาชิก', detail: 'โปรไฟล์ เบอร์โทร ทีม/หัวหน้าทีม สถานะอนุมัติ', status: 'under_review' },
      { title: 'แปลงเพาะปลูก', detail: 'รายการแปลง เพิ่ม/แก้ไข พิกัด GPS และภาพหลักฐาน', status: 'submitted' },
      { title: 'จองเมล็ดพันธุ์', detail: 'เลือกชนิดเมล็ด ปริมาณ รอบปลูก และสถานะคำขอ', status: 'draft' },
      { title: 'นัดขายผลผลิต', detail: 'เลือกช่วงเวลา ปริมาณคาดการณ์ และสถานะนัดหมาย', status: 'scheduled' },
      { title: 'โครงการไม่เผา', detail: 'สมัครเข้าร่วม ถ่ายภาพหลักฐาน และติดตามผลตรวจ', status: 'submitted' },
    ],
    nextActions: ['กรอกข้อมูลสมาชิกให้ครบ', 'เพิ่มแปลงแรก', 'สมัครโครงการไม่เผา'],
  },
  {
    href: '/service',
    label: 'รถ/บริการ',
    title: 'รถร่วมและผู้ให้บริการ',
    subtitle: 'รถไถ รถเกี่ยว รถขนส่ง ตั้งคิวว่าง รับงาน และดูประวัติเที่ยวงาน',
    roleBadge: 'Service',
    progressCurrent: 4,
    progressTotal: 8,
    kpis: [
      { label: 'รถ/เครื่องจักร', value: '4', detail: 'ตัวอย่างทะเบียนบริการ' },
      { label: 'คิวว่าง', value: '6 วัน', detail: 'ปฏิทินพร้อมรับงาน' },
      { label: 'เที่ยวงาน', value: '18', detail: 'ประวัติเข้าโรงงานตัวอย่าง' },
    ],
    workflows: [
      { title: 'โปรไฟล์ผู้ให้บริการ', detail: 'ข้อมูลเจ้าของ ประเภทบริการ พื้นที่ให้บริการ', status: 'under_review' },
      { title: 'รายการรถ/เครื่องจักร', detail: 'รถไถ รถเกี่ยว รถขนส่ง พร้อมสถานะใช้งาน', status: 'submitted' },
      { title: 'ปฏิทินคิวว่าง', detail: 'กำหนดวันว่าง รับงาน และปิดคิว', status: 'scheduled' },
      { title: 'งานที่ถูกจอง', detail: 'รับ/ปฏิเสธงาน ดูสถานที่และรายละเอียดสมาชิก', status: 'draft' },
      { title: 'สมัครเป็นผู้ตรวจแปลง', detail: 'ขอรับรองเพิ่มบทบาท inspector', status: 'draft' },
    ],
    nextActions: ['เพิ่มรถ/เครื่องจักร', 'ตั้งตารางว่าง', 'เปิดรับงานทดลอง'],
  },
  {
    href: '/field',
    label: 'ทีมสนาม',
    title: 'ทีมภาคสนาม',
    subtitle: 'รับงานตรวจแปลง ตรวจไม่เผา เก็บ GPS/รูปภาพ และช่วยเหลือสมาชิก',
    roleBadge: 'Field',
    progressCurrent: 4,
    progressTotal: 8,
    kpis: [
      { label: 'งานวันนี้', value: '7', detail: 'รายการตรวจตัวอย่าง' },
      { label: 'รอส่งผล', value: '3', detail: 'มีภาพ/GPS แล้ว' },
      { label: 'พื้นที่เสี่ยง', value: '2', detail: 'ต้องติดตามซ้ำ' },
    ],
    workflows: [
      { title: 'งานตรวจที่ได้รับมอบหมาย', detail: 'รายการแปลง สถานะ และเวลานัดหมาย', status: 'under_review' },
      { title: 'ตรวจแปลง', detail: 'ฟอร์มสำรวจ GPS รูปภาพ และ checklist', status: 'submitted' },
      { title: 'ตรวจไม่เผา', detail: 'บันทึกหลักฐาน สรุปผล และข้อสังเกต', status: 'draft' },
      { title: 'ช่วยเหลือสมาชิก', detail: 'ค้นหาสมาชิก เพิ่มข้อมูลเบื้องต้นแทนสมาชิก', status: 'draft' },
      { title: 'สรุปงานประจำวัน', detail: 'งานเสร็จ งานค้าง และเหตุผิดปกติ', status: 'scheduled' },
    ],
    nextActions: ['เปิดงานตรวจวันนี้', 'บันทึก GPS/รูปภาพ', 'ส่งผลตรวจตัวอย่าง'],
  },
  {
    href: '/admin-prototype',
    label: 'หลังบ้าน',
    title: 'หลังบ้านและผู้บริหาร',
    subtitle: 'อนุมัติสมาชิก จัดทีม ตรวจภาพรวม และรายงานการดำเนินงาน',
    roleBadge: 'Admin',
    progressCurrent: 5,
    progressTotal: 9,
    kpis: [
      { label: 'รออนุมัติ', value: '12', detail: 'สมาชิก/รถ/บทบาท' },
      { label: 'คำขอไม่เผา', value: '48', detail: 'รอคิวตรวจ/ตรวจแล้ว' },
      { label: 'งานสนาม', value: '31', detail: 'งาน active ทั้งหมด' },
    ],
    workflows: [
      { title: 'อนุมัติสมาชิก', detail: 'approve/reject และกำหนด role เริ่มต้น', status: 'under_review' },
      { title: 'จัดทีม/หัวหน้าทีม', detail: 'กลุ่มสมาชิก หัวหน้าทีม และผู้ช่วยภาคสนาม', status: 'draft' },
      { title: 'อนุมัติรถ/ผู้ให้บริการ', detail: 'ตรวจข้อมูลรถ เครื่องจักร และตารางว่าง', status: 'draft' },
      { title: 'ติดตามโครงการไม่เผา', detail: 'สถานะคำขอ ผลตรวจ และสิทธิ์ที่ได้รับ', status: 'submitted' },
      { title: 'รายงานผู้บริหาร', detail: 'ภาพรวมสมาชิก แปลง พื้นที่ และงานสนาม', status: 'draft' },
    ],
    nextActions: ['อนุมัติสมาชิก pending', 'ตรวจภาพรวมงานสนาม', 'เตรียม dashboard รายงาน'],
  },
];

function getArea(slug: string) {
  return AREAS.find((area) => area.href === slug) ?? AREAS[0];
}

function AreaSwitcher({ activeHref }: { activeHref: string }) {
  return (
    <div className="prototype-area-switcher" aria-label="Prototype app areas">
      {AREAS.map((area) => (
        <Link
          key={area.href}
          href={area.href}
          className={[
            'prototype-area-switcher__item',
            activeHref === area.href ? 'prototype-area-switcher__item--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {area.label}
        </Link>
      ))}
    </div>
  );
}

function MockNotice() {
  return (
    <div className="prototype-notice">
      Prototype UI เท่านั้น: ข้อมูลในหน้านี้เป็น mock data เพื่อ review หน้าจอและ flow ก่อนผูก backend/RLS
    </div>
  );
}

export function AppAreaPrototype({ areaHref }: { areaHref: string }) {
  const area = getArea(areaHref);

  return (
    <MobileAppShell title={area.title} subtitle={area.subtitle} roleBadge={area.roleBadge}>
      <AreaSwitcher activeHref={area.href} />
      <MockNotice />

      <SectionHeader
        title="ภาพรวม"
        subtitle="Mock dashboard สำหรับตรวจทิศทาง UX"
        action={<ProgressBadge current={area.progressCurrent} total={area.progressTotal} />}
      />

      <div className="prototype-kpi-grid">
        {area.kpis.map((kpi) => (
          <article key={kpi.label} className="prototype-kpi-card">
            <p className="prototype-kpi-card__label">{kpi.label}</p>
            <strong className="prototype-kpi-card__value">{kpi.value}</strong>
            <span className="prototype-kpi-card__detail">{kpi.detail}</span>
          </article>
        ))}
      </div>

      <SectionHeader title="Flow หลัก" subtitle="หน้าจอที่ต้องมีใน phase prototype" />
      <div className="prototype-workflow-list">
        {area.workflows.map((workflow) => (
          <article key={workflow.title} className="prototype-workflow-card">
            <div>
              <h2>{workflow.title}</h2>
              <p>{workflow.detail}</p>
            </div>
            <StatusChip status={workflow.status} />
          </article>
        ))}
      </div>

      <SectionHeader title="งานถัดไป" subtitle="ใช้เป็น checklist ตอน review UI" />
      <div className="prototype-action-list">
        {area.nextActions.map((action) => (
          <UIButton key={action} fullWidth>
            {action}
          </UIButton>
        ))}
      </div>
    </MobileAppShell>
  );
}
