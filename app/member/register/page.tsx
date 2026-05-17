'use client';

import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { useAuth } from '@/providers/auth-provider';
import { LiffRequiredGuard } from '@/shared/components/liff-required-guard';
import { ProtectedRoute } from '@/shared/components/protected-route';

function RegisterScreen() {
  const { member } = useAuth();
  const lineUserId = member?.line_user_id;

  // line_user_id ไม่มี = เปิดนอก LIFF context
  if (!lineUserId) {
    return <LiffRequiredGuard>{null}</LiffRequiredGuard>;
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
    <LiffRequiredGuard>
      <ProtectedRoute fallbackPendingApproval={<RegisterScreen />} fallbackRejected={<RegisterScreen />} fallbackAccessDenied={<RegisterScreen />}>
        <RegisterScreen />
      </ProtectedRoute>
    </LiffRequiredGuard>
  );
}
