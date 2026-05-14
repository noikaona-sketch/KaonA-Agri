'use client';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SeedVarietiesList } from '@/features/member-seed-varieties/seed-varieties-list';

export default function VarietiesPage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="🌾 พันธุ์เมล็ด" subtitle="ข้อมูลพันธุ์และวิธีการปลูก">
        <SeedVarietiesList />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
