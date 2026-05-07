'use client';

import { MemberProfileScreen } from '@/features/member-profile/member-profile-screen';
import { ProtectedRoute } from '@/shared/components/protected-route';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <MemberProfileScreen />
    </ProtectedRoute>
  );
}
