import { AdminHarvestList } from '@/features/admin-harvest/admin-harvest-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="🚜 นัดรถเกี่ยว" subtitle="จัดการนัดรถเกี่ยวและติดตามรถ"><AdminHarvestList /></AdminWebShell>;
}
