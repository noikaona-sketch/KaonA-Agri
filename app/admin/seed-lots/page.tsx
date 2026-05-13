import { AdminSeedLots } from '@/features/admin-seed-lots/admin-seed-lots';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📦 Stock เมล็ดพันธุ์" subtitle="รับเข้า LOT และดูยอดสต๊อก"><AdminSeedLots /></AdminWebShell>;
}
