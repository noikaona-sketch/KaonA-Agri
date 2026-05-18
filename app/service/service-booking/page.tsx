'use client';

import { MobileAppShell }    from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }    from '@/shared/components/protected-route';
import { ServiceBookingMVP } from '@/features/service-booking-mvp';

export default function ServiceBookingPage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="จองบริการ" subtitle="รถไถ · รถเกี่ยว · รถขนส่ง">
        <ServiceBookingMVP />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
