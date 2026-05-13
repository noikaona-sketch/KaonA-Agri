import Link from 'next/link';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { PlantingCycleDetail } from '@/features/member-planting/planting-cycle-detail';

type Props = { params: { id: string } };
export default function PlantingCycleDetailPage({ params }: Props) {
  return (
    <MobileAppShell title="รายละเอียดรอบปลูก" subtitle="ติดตามและบันทึกความคืบหน้า">
      <div style={{ marginBottom: 12 }}>
        <Link href="/planting-cycles" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← กลับรายการ</Link>
      </div>
      <PlantingCycleDetail cycleId={params.id} />
    </MobileAppShell>
  );
}
