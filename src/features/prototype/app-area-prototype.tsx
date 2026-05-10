'use client';

import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { EmptyState } from '@/shared/components/empty-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';
import Link from 'next/link';

interface AppAreaPrototypeProps {
  areaHref: '/member' | '/service' | '/field' | '/admin-prototype';
}

type AreaConfig = {
  title: string;
  subtitle: string;
  roleBadge: string;
  cardTitle: string;
  cardSubtitle: string;
  actionLabel: string;
  workflowTitle: string;
  workflows: Array<{ title: string; detail: string; done?: boolean }>;
  summaryTitle: string;
  summaryDetail: string;
};

const AREA_CONFIG: Record<AppAreaPrototypeProps['areaHref'], AreaConfig> = {
  '/member': {
    title: 'เกษตรกรสมาชิก KaonA',
    subtitle: 'มือถือสำหรับจัดการแปลง จองเมล็ด และนัดขายผลผลิต',
    roleBadge: 'สมาชิก',
    cardTitle: 'งานของฉันวันนี้',
    cardSubtitle: 'ติดตามสถานะเอกสารและกิจกรรมในรอบเพาะปลูก',
    actionLabel: 'เริ่มลงทะเบียนแปลง',
    workflowTitle: 'เวิร์กโฟลว์เกษตรกร',
    workflows: [
      { title: 'โปรไฟล์สมาชิก', detail: 'อัปเดตข้อมูลเกษตรกรและช่องทางติดต่อ', done: true },
      { title: 'ลงทะเบียนแปลงเพาะปลูก', detail: 'บันทึกพิกัด ขนาดแปลง และรูปหลักฐาน', done: true },
      { title: 'จองเมล็ดพันธุ์', detail: 'เลือกชนิดเมล็ด ปริมาณ และรอบรับสินค้า' },
      { title: 'นัดหมายขายผลผลิต', detail: 'กำหนดวันรับซื้อ น้ำหนักคาดการณ์ และจุดนัดหมาย' },
      { title: 'เข้าร่วมไม่เผา', detail: 'ส่งหลักฐานกิจกรรมลดการเผาในแปลง' },
    ],
    summaryTitle: 'สถานะพื้นที่สมาชิก',
    summaryDetail: 'พร้อมส่งคำขอตรวจแปลงและเข้าร่วมโครงการไม่เผา',
  },
  '/service': {
    title: 'ผู้ให้บริการเครื่องจักร KaonA',
    subtitle: 'จัดการรถบริการ ปฏิทินว่าง และประวัติงานวิ่ง',
    roleBadge: 'ผู้ให้บริการ',
    cardTitle: 'คิวงานบริการ',
    cardSubtitle: 'ดูงานที่รับแล้วและแผนวิ่งประจำวัน',
    actionLabel: 'อัปเดตปฏิทินว่าง',
    workflowTitle: 'เวิร์กโฟลว์ผู้ให้บริการ',
    workflows: [
      { title: 'รายการรถ/เครื่องจักร', detail: 'บันทึกประเภทเครื่องจักร ความจุ และพื้นที่ให้บริการ', done: true },
      { title: 'ปฏิทินวันว่าง', detail: 'ระบุช่วงเวลาว่างสำหรับรับงานรายสัปดาห์' },
      { title: 'งานที่ตอบรับแล้ว', detail: 'ยืนยันรายละเอียดแปลงและเวลานัดหมายกับสมาชิก' },
      { title: 'ประวัติการวิ่งงาน', detail: 'สรุประยะทาง ค่าใช้จ่าย และสถานะงานย้อนหลัง' },
    ],
    summaryTitle: 'สรุปงานบริการ',
    summaryDetail: 'มีงานรอยืนยัน 2 งาน และงานเสร็จสิ้นวันนี้ 3 งาน',
  },
  '/field': {
    title: 'ทีมภาคสนาม KaonA',
    subtitle: 'ตรวจแปลง เก็บหลักฐาน GPS/ภาพ และช่วยเหลือสมาชิก',
    roleBadge: 'ทีมภาคสนาม',
    cardTitle: 'ภารกิจตรวจพื้นที่',
    cardSubtitle: 'โฟกัสงานตรวจแปลงและยืนยันกิจกรรมไม่เผา',
    actionLabel: 'เริ่มตรวจแปลงที่ได้รับมอบหมาย',
    workflowTitle: 'เวิร์กโฟลว์ภาคสนาม',
    workflows: [
      { title: 'งานตรวจที่ได้รับมอบหมาย', detail: 'เรียงลำดับคิวตรวจตามพิกัดและกำหนดเวลา', done: true },
      { title: 'หลักฐาน GPS/รูปถ่าย', detail: 'เก็บภาพหน้างานพร้อมพิกัดและเวลาอัตโนมัติ' },
      { title: 'ยืนยันไม่เผา', detail: 'บันทึกผลตรวจและสถานะการเข้าร่วมโครงการไม่เผา' },
      { title: 'ช่วยเหลือสมาชิก', detail: 'ลงบันทึกคำแนะนำหน้างานและปัญหาที่พบ' },
    ],
    summaryTitle: 'ภาพรวมภาคสนาม',
    summaryDetail: 'เหลืองานตรวจ 4 แปลง และมีงานต้องติดตามเพิ่ม 1 เคส',
  },
  '/admin-prototype': {
    title: 'ศูนย์ปฏิบัติการ KaonA',
    subtitle: 'อนุมัติสมาชิก จัดสิทธิ์บทบาท และดูแดชบอร์ดบริหาร',
    roleBadge: 'แอดมิน',
    cardTitle: 'งานอนุมัติและกำกับดูแล',
    cardSubtitle: 'จัดการคิวอนุมัติสมาชิกและติดตามประสิทธิภาพทีม',
    actionLabel: 'ตรวจคิวอนุมัติสมาชิก',
    workflowTitle: 'เวิร์กโฟลว์แอดมิน',
    workflows: [
      { title: 'อนุมัติสมาชิกใหม่', detail: 'ตรวจเอกสารและยืนยันสถานะการสมัคร', done: true },
      { title: 'กำหนดบทบาทผู้ใช้', detail: 'มอบสิทธิ์สมาชิก/ภาคสนาม/ผู้ให้บริการตามหน้าที่' },
      { title: 'ภาพรวมปฏิบัติการภาคสนาม', detail: 'ติดตามจำนวนงานตรวจ แผนงาน และปัญหาหน้างาน' },
      { title: 'แดชบอร์ดผู้บริหาร', detail: 'ดู KPI ด้านสมาชิก พื้นที่เพาะปลูก และโครงการไม่เผา' },
    ],
    summaryTitle: 'สรุประดับบริหาร',
    summaryDetail: 'รออนุมัติสมาชิก 12 ราย และงานภาคสนามกำลังดำเนินการ 18 งาน',
  },
};

export function AppAreaPrototype({ areaHref }: AppAreaPrototypeProps) {
  const area = AREA_CONFIG[areaHref];
  const areaLinks: AppAreaPrototypeProps['areaHref'][] = ['/member', '/service', '/field', '/admin-prototype'];

  const areaLabel: Record<AppAreaPrototypeProps['areaHref'], string> = {
    '/member': 'สมาชิก',
    '/service': 'ผู้ให้บริการ',
    '/field': 'ภาคสนาม',
    '/admin-prototype': 'แอดมิน',
  };

  return (
    <MobileAppShell title={area.title} subtitle={area.subtitle} roleBadge={area.roleBadge}>
      <FormSheet title="สลับบทบาท (ต้นแบบ UX)">
        <div className="app-area-switcher" role="tablist" aria-label="Role switcher">
          {areaLinks.map((href) => (
            <Link
              key={href}
              href={href}
              className={[
                'app-area-switcher__item',
                href === areaHref ? 'app-area-switcher__item--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={href === areaHref ? 'page' : undefined}
            >
              {areaLabel[href]}
            </Link>
          ))}
        </div>
      </FormSheet>
      <SectionHeader title={area.workflowTitle} subtitle="ต้นแบบมือถือสำหรับ KaonA-Agri" action={<ProgressBadge current={area.workflows.length} total={area.workflows.length} />} />
      <InfoCard
        title={area.cardTitle}
        subtitle={area.cardSubtitle}
        meta={<StatusChip status="submitted" />}
        action={<UIButton fullWidth>{area.actionLabel}</UIButton>}
      />

      {areaHref === '/member' ? (
        <>
          <PlotRegistrationMVP />
          <NoBurnParticipationWorkflow />
        </>
      ) : null}

      <FormSheet title="เช็กลิสต์งานหลัก">
        <StepList steps={area.workflows} />
        {areaHref === '/field' ? <PhotoUploadPlaceholder label="หลักฐานภาพถ่ายพร้อมพิกัด GPS สำหรับงานภาคสนาม" /> : null}
      </FormSheet>

      <EmptyState title={area.summaryTitle} detail={area.summaryDetail} />
    </MobileAppShell>
  );
}
