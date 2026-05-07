'use client';

import { PlotRegistrationGps } from '@/features/plot-registration-gps';
import { MemberRegistrationMVP } from '@/features/member-registration-mvp';
import { useAuth } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';

function resolveLineUserId(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null;

  const candidates = ['line_user_id', 'sub', 'provider_id', 'preferred_username']
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates[0] ?? null;
}

function NoMemberFallback() {
  const { session } = useAuth();

  if (!session) return null;

  const lineUserId = resolveLineUserId(session.user.user_metadata as Record<string, unknown> | undefined);

  if (!lineUserId) {
    return (
      <main className="mobile-shell">
        <ErrorState title="LINE identity is missing. Please reopen from LINE." />
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <MemberRegistrationMVP
        lineUserId={lineUserId}
        onSubmitted={async () => {
          window.location.reload();
        }}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute fallbackNoMember={<NoMemberFallback />}>
      <MobileAppShell title="KaonA Agri" subtitle="Plot registration with GPS evidence." roleBadge="Farmer">
        <PlotRegistrationGps />
      </MobileAppShell>
    </ProtectedRoute>
  );
}
