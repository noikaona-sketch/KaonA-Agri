import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { MemberSeedReservation } from '@/features/member-shop/member-seed-reservation';
export default function Page() {
  return (
    <MobileAppShell title="จองเมล็ดพันธุ์" subtitle="เลือก LOT ราคาตรง ยืนยันโดย admin">
      <MemberSeedReservation />
    </MobileAppShell>
  );
}
