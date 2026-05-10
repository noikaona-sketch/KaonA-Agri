'use client';

import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { PlotRegistrationMVP } from '@/features/plot-registration-mvp';
import { NoBurnParticipationWorkflow } from '@/features/no-burn-participation-workflow';
import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';

function NoMemberFallback() {
  const { member } = useAuth();
  const lineUserId = member?.line_user_id ?? null;

  if (!lineUserId) {
    return (
      <main className="mobile-shell">
        <ErrorState title="LINE identity is missing. Please reopen from LINE." />
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <MemberRegistrationMVP
        lineUserId={lineUserId}
        onSubmitted={async () => {
          window.location.reload();
        }}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute fallbackNoMember={<NoMemberFallback />}>
      <MobileAppShell title="หน้าหลักสมาชิก" subtitle="ติดตามงานเกษตรและสถานะคำขอผ่าน LINE" roleBadge="สมาชิก">
        <SectionHeader title="แดชบอร์ดสมาชิก" subtitle="รอบเพาะปลูก 2569/1" action={<ProgressBadge current={2} total={4} />} />
        <InfoCard
          title="สถานะรอบเพาะปลูก"
          subtitle="อยู่ระหว่างดูแลแปลงและบันทึกกิจกรรม"
          meta={<StatusChip status="under_review" />}
          action={<UIButton fullWidth>ดูแผนงานรอบนี้</UIButton>}
        />
        <InfoCard
          title="นัดหมายตรวจแปลง"
          subtitle="เจ้าหน้าที่นัดตรวจวันที่ 15 พฤษภาคม 2026"
          meta={<StatusChip status="scheduled" />}
          action={<UIButton variant="secondary" fullWidth>ยืนยันนัดหมาย</UIButton>}
        />

        <PlotRegistrationMVP />
        <NoBurnParticipationWorkflow />

        <FormSheet title="การลงทะเบียนแปลงและหลักฐาน">
          <StepList
            steps={[
              { title: 'ลงทะเบียนข้อมูลแปลง', done: true, detail: 'บันทึกพิกัดและขนาดพื้นที่เรียบร้อย' },
              { title: 'อัปโหลดภาพแปลงพร้อม GPS', detail: 'ถ่ายภาพจากจุดกลางแปลงเพื่อยืนยันพิกัด' },
            ]}
          />
          <PhotoUploadPlaceholder label="ภาพแปลงและพิกัด GPS" />
        </FormSheet>



        <SectionHeader title="ผู้ให้บริการและรถขนส่ง" subtitle="Mockup การจองบริการสำหรับสมาชิก" action={<ProgressBadge current={1} total={3} />} />
        <InfoCard
          title="ผู้ให้บริการตัดอ้อย"
          subtitle="บริษัท เกษตรร่วมใจ จำกัด • ระยะทาง 8 กม."
          meta={<StatusChip status="approved" />}
          action={<UIButton fullWidth>เลือกผู้ให้บริการ</UIButton>}
        />
        <InfoCard
          title="รถขนส่งผลผลิต"
          subtitle="รถ 6 ล้อ ทะเบียน 82-4587 • ว่างวันที่ 18 พฤษภาคม 2026"
          meta={<StatusChip status="draft" />}
          action={<UIButton variant="secondary" fullWidth>จองคิวรถ</UIButton>}
        />
        <FormSheet title="สรุปคำขอบริการ">
          <StepList
            steps={[
              { title: 'เลือกผู้ให้บริการ', done: true, detail: 'ยืนยันผู้รับจ้างตัดอ้อยแล้ว' },
              { title: 'เลือกประเภทรถและวันขนส่ง', detail: 'เลือกรถให้ตรงกับปริมาณผลผลิต' },
              { title: 'ส่งคำขอเพื่อรออนุมัติ', detail: 'เจ้าหน้าที่ตรวจสอบและยืนยันคิวงาน' },
            ]}
          />
          <UIButton variant="ghost" fullWidth>ดูรายละเอียดคำขอ</UIButton>
        </FormSheet>

        <InfoCard
          title="การเข้าร่วมงดเผา"
          subtitle="คำขอเข้าร่วมอยู่ระหว่างรอเจ้าหน้าที่อนุมัติ"
          meta={<StatusChip status="under_review" />}
          action={<UIButton variant="ghost" fullWidth>แก้ไขคำขอ</UIButton>}
        />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
