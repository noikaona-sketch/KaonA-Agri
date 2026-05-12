import Link from 'next/link';

import { AdminMemberDetail } from '@/features/admin-members/admin-member-detail';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

type Props = { params: { id: string } };

export default function AdminMemberDetailPage({ params }: Props) {
  return (
    <AdminWebShell title="รายละเอียดสมาชิก" subtitle="ข้อมูล แปลง รถ และสถานะสมาชิก">
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/members" className="admin-btn admin-btn--secondary">
          ← กลับรายชื่อสมาชิก
        </Link>
      </div>
      <AdminMemberDetail memberId={params.id} />
    </AdminWebShell>
  );
}
