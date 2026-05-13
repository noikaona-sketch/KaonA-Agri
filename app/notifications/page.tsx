import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { NotificationsList } from '@/features/member-planting/notifications-list';

export default function NotificationsPage() {
  return (
    <MobileAppShell title="การแจ้งเตือน" subtitle="ข่าวสารและอัพเดทจากระบบ">
      <NotificationsList />
    </MobileAppShell>
  );
}
