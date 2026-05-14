'use client';

import { useRouter } from 'next/navigation';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { NotificationsList } from '@/features/member-planting/notifications-list';

export default function NotificationsPage() {
  const router = useRouter();
  return (
    <MobileAppShell title="🔔 การแจ้งเตือน" subtitle="ข่าวสารและอัพเดทจากระบบ">
      <div className="mobile-stack">
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 15, padding: 0, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← กลับ
        </button>
        <NotificationsList />
      </div>
    </MobileAppShell>
  );
}
