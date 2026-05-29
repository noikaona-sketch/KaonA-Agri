'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { LoadingState } from '@/shared/components/loading-state';
import { SeedReservationFlow } from '@/features/member-seed-reservation/seed-reservation-flow';

function SeedReservationsPageContent() {
  const searchParams = useSearchParams();
  const selectedPlotId = searchParams.get('plot_id') ?? undefined;

  return <SeedReservationFlow selectedPlotId={selectedPlotId} />;
}

export default function SeedReservationsPage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="🌽 จองเมล็ดพันธุ์" subtitle="เลือกพันธุ์ → กรอกจำนวน → จอง">
        <Suspense fallback={<LoadingState label="กำลังโหลด…" />}>
          <SeedReservationsPageContent />
        </Suspense>
      </MobileAppShell>
    </ProtectedRoute>
  );
}
