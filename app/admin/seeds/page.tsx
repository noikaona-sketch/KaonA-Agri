import { AdminSeedsList } from '@/features/admin-seeds/admin-seeds-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

export default function AdminPage() {
  return (
    <AdminWebShell title="🌾 สั่งเมล็ดพันธุ์" subtitle="อนุมัติและจัดส่งเมล็ดพันธุ์">
      <AdminSeedsList />
    </AdminWebShell>
  );
}
