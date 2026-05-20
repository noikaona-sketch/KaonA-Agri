'use client';

import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { HarvestIntakeCalendar } from '@/features/admin-harvest/harvest-intake-calendar';

export default function AdminHarvestCalendarPage() {
  return (
    <AdminWebShell
      title="🗓️ ปฏิทินรับผลผลิต"
      subtitle="สรุปคิวรับเข้าโรงงานรายวัน/รายสัปดาห์ (อ่านอย่างเดียว)"
    >
      <HarvestIntakeCalendar />
    </AdminWebShell>
  );
}

