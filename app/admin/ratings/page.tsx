import { AdminProviderRatings } from '@/features/admin-ratings/admin-provider-ratings';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return (
    <AdminWebShell title="⭐ คะแนนผู้ให้บริการ" subtitle="ดูและวิเคราะห์คะแนนรถเกี่ยวและทีมบริการ">
      <AdminProviderRatings />
    </AdminWebShell>
  );
}
