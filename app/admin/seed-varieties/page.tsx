import { AdminSeedVarieties } from '@/features/admin-seed-varieties/admin-seed-varieties';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="🌾 พันธุ์เมล็ดพันธุ์" subtitle="จัดการพันธุ์เมล็ดพันธุ์ทั้งหมด"><AdminSeedVarieties /></AdminWebShell>;
}
