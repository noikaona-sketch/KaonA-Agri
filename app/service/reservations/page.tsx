'use client';

import { Suspense }            from 'react';
import { useSearchParams }     from 'next/navigation';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { SeedReservationFlow } from '@/features/member-seed-reservation/seed-reservation-flow';

function ReservationsContent() {
  const params     = useSearchParams();
  const plotId     = params.get('plot_id') ?? null;
  return (
    <MobileAppShell title="🌽 จองเมล็ดพันธุ์" subtitle="เลือกพันธุ์ → กรอกจำนวน → จอง">
      <SeedReservationFlow initialPlotId={plotId} />
    </MobileAppShell>
  );
}

export default function SeedReservationsPage() {
  return (
    <ProtectedRoute>
      <Suspense>
        <ReservationsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
