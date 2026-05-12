'use client';

import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { ProtectedRoute } from '@/shared/components/protected-route';

function RegisterScreen() {
  const { member } = useAuth();
  const lineUserId = member?.line_user_id;

  if (!lineUserId) {
    return <ErrorState title="ไม่พบข้อมูล LINE" detail="กรุณาปิดและเปิด Mini App ใหม่จาก LINE" />;
  }

  return (
    <MemberRegistrationMVP
      lineUserId={lineUserId}
      onSubmitted={async () => {
        window.location.reload();
      }}
    />
  );
}

export default function MemberRegisterPage() {
  return (
    <ProtectedRoute fallbackPendingApproval={<RegisterScreen />} fallbackRejected={<RegisterScreen />} fallbackAccessDenied={<RegisterScreen />}>
      <RegisterScreen />
    </ProtectedRoute>
  );
}
