import { AdminSeedSuppliers } from '@/features/admin-seed-suppliers/admin-seed-suppliers';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="🏪 Supplier เมล็ดพันธุ์" subtitle="จัดการ Supplier และเงื่อนไขเครดิต"><AdminSeedSuppliers /></AdminWebShell>;
}
