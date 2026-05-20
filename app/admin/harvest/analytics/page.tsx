'use client';

import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { HarvestAnalyticsPage } from '@/features/admin-harvest/harvest-analytics-page';

export default function AdminHarvestAnalyticsRoute() {
  return (
    <AdminWebShell title="📈 Harvest Analytics" subtitle="สรุป 7/30 วัน (Read-only)">
      <HarvestAnalyticsPage />
    </AdminWebShell>
  );
}
