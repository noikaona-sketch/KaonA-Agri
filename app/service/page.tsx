import { ServiceBookingMVP } from '@/features/service-booking-mvp';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServicePage() {
  return (
    <MobileAppShell title="จองบริการ" subtitle="เลือกบริการ เลือกวัน ดูคิวว่าง และส่งคำขอ" roleBadge="สมาชิกเกษตรกร">
      <ServiceBookingMVP />
    </MobileAppShell>
  );
}
