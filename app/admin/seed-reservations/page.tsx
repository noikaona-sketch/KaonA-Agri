import { AdminSeedReservations } from '@/features/admin-seed-reservations/admin-seed-reservations';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📋 คิวจองเมล็ดพันธุ์" subtitle="ยืนยัน รับสินค้า และตัด stock"><AdminSeedReservations /></AdminWebShell>;
}
