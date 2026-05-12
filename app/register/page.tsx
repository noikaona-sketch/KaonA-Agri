'use client';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { RegisterTabs } from '@/features/member-register-tabs/register-tabs';

function RegisterContent() {
  return (
    <MobileAppShell title="สมัครเข้าร่วม KaonA" subtitle="เลือกประเภทการสมัครของคุณ">
      <RegisterTabs />
    </MobileAppShell>
  );
}

export default function RegisterPage() {
  return (
    <ProtectedRoute
      fallbackNoMember={<RegisterContent />}
      fallbackPendingApproval={<RegisterContent />}
      fallbackRejected={<RegisterContent />}
      fallbackAccessDenied={<RegisterContent />}
    >
      <RegisterContent />
    </ProtectedRoute>
  );
}
