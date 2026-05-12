'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { RegisterPinForm } from '@/features/member-register-tabs/register-pin-form';
import { RegisterPinSuccess } from '@/features/member-register-tabs/register-pin-success';

function PinContent() {
  const { member } = useAuth();
  const router = useRouter();
  const [successRole, setSuccessRole] = useState<string | null>(null);

  const lineUserId = member?.line_user_id;

  if (!lineUserId) {
    return <ErrorState title="ไม่พบข้อมูล LINE" detail="กรุณาปิดและเปิด Mini App ใหม่จาก LINE" />;
  }

  return (
    <MobileAppShell title="เข้าระบบด้วย PIN" subtitle="สำหรับทีมภาคสนามและเจ้าหน้าที่">
      {successRole ? (
        <RegisterPinSuccess
          role={successRole}
          onDone={() => router.replace('/')}
        />
      ) : (
        <RegisterPinForm
          lineUserId={lineUserId}
          onSuccess={(role) => setSuccessRole(role)}
        />
      )}
    </MobileAppShell>
  );
}

export default function RegisterPinPage() {
  return (
    <ProtectedRoute
      fallbackNoMember={<PinContent />}
      fallbackPendingApproval={<PinContent />}
      fallbackAccessDenied={<PinContent />}
    >
      <PinContent />
    </ProtectedRoute>
  );
}
