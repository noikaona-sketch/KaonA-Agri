import { ServiceBookingMVP } from '@/features/service-booking-mvp';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServiceBookingPage() {
  return (
    <MobileAppShell title="จองบริการ" subtitle="เลือกบริการ → เลือกวัน → ส่งคำขอ" roleBadge="สมาชิกเกษตรกร">
      <ServiceBookingMVP />
    </MobileAppShell>
  );
}
