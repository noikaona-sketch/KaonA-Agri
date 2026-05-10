import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { InfoCard } from '@/shared/components/info-card';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

export function MemberUIMock() {
  return (
    <MobileAppShell title="หน้าหลักสมาชิก" subtitle="Mockup สำหรับสมาชิกใน LINE OA" roleBadge="สมาชิก">
      <SectionHeader
        title="สถานะรอบเพาะปลูก"
        subtitle="ฤดู 2569/1"
        action={<ProgressBadge current={2} total={4} />}
      />

      <InfoCard
        title="ขึ้นทะเบียนแปลง"
        subtitle="ส่งข้อมูลแปลงและขอบเขตพื้นที่"
        meta={<StatusChip status="submitted" />}
        action={<UIButton fullWidth>ดูรายละเอียด</UIButton>}
      />

      <InfoCard
        title="งานตรวจแปลงล่าสุด"
        subtitle="นัดหมายตรวจวันที่ 15 พฤษภาคม 2026"
        meta={<StatusChip status="scheduled" />}
        action={<UIButton variant="secondary" fullWidth>ยืนยันนัดหมาย</UIButton>}
      />

      <InfoCard
        title="การเข้าร่วมงดเผา"
        subtitle="รอการอนุมัติจากเจ้าหน้าที่"
        meta={<StatusChip status="under_review" />}
        action={<UIButton variant="ghost" fullWidth>แก้ไขคำขอ</UIButton>}
      />
    </MobileAppShell>
  );
}
