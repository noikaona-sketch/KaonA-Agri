'use client';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { SeedReservationFlow } from '@/features/member-seed-reservation/seed-reservation-flow';

export default function SeedReservationsPage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="🌾 จองเมล็ดพันธุ์" subtitle="เลือก Supplier → พันธุ์ → จอง">
        <SeedReservationFlow />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
