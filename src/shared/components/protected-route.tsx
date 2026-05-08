'use client';

import type { ReactNode } from 'react';

import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import type { AppRole, LiffBridgeDiagnostics } from '@/shared/auth/auth-types';

type ProtectedRouteProps = {
  allowedRoles?: AppRole[];
  children: ReactNode;
  fallbackLoading?: ReactNode;
  fallbackUnauthenticated?: ReactNode;
  fallbackNoMember?: ReactNode;
  fallbackPendingApproval?: ReactNode;
  fallbackRejected?: ReactNode;
  fallbackSuspended?: ReactNode;
  fallbackAccessDenied?: ReactNode;
  fallbackError?: ReactNode;
};

function StateView({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">Authentication</p>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>
      </section>
    </main>
  );
}

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

function formatBridgeDiagnostics(diagnostics: LiffBridgeDiagnostics) {
  return [
    `LIFF config present: ${yesNo(diagnostics.liffConfigPresent)}`,
    `LIFF SDK load: ${diagnostics.liffSdkLoad}`,
    `LIFF window present: ${yesNo(diagnostics.liffWindowPresent)}`,
    `LIFF init attempted: ${yesNo(diagnostics.liffInitAttempted)}`,
    `LIFF init success: ${yesNo(diagnostics.liffInitSuccess)}`,
    `LIFF init error: ${diagnostics.liffInitError ?? 'none'}`,
    `Runtime mode: ${diagnostics.runtimeMode}`,
    `LIFF initialized: ${yesNo(diagnostics.liffInitialized)}`,
    `LIFF logged in: ${yesNo(diagnostics.liffLoggedIn)}`,
    `ID token present: ${yesNo(diagnostics.idTokenPresent)}`,
    `Supabase bridge: ${diagnostics.bridgeSuccess ? 'success' : diagnostics.bridgeAttempted ? 'failed' : 'not attempted'}`,
    `Bridge message: ${diagnostics.bridgeErrorMessage ?? 'none'}`,
  ].join(' · ');
}

export function ProtectedRoute({ allowedRoles, children, ...fallbacks }: ProtectedRouteProps) {
  const { status, session, errorMessage, bridgeDiagnostics } = useAuth();
  const member = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  if (status === 'loading') return fallbacks.fallbackLoading ?? <StateView title="Checking session" subtitle="Confirming your authentication state." />;
  if (!session)
    return (
      fallbacks.fallbackUnauthenticated ?? (
        <StateView title="Authentication bridge required" subtitle={formatBridgeDiagnostics(bridgeDiagnostics)} />
      )
    );
  if (!member || status === 'no_member') return fallbacks.fallbackNoMember ?? <StateView title="No member profile" subtitle="Your account is not linked to a member profile." />;
  if (status === 'pending_approval') return fallbacks.fallbackPendingApproval ?? <StateView title="Pending approval" subtitle="Your account is awaiting approval." />;
  if (status === 'rejected') return fallbacks.fallbackRejected ?? <StateView title="Access rejected" subtitle="Your member access request was rejected." />;
  if (status === 'suspended') return fallbacks.fallbackSuspended ?? <StateView title="Account suspended" subtitle="Your member account is suspended." />;
  if (status === 'error') return fallbacks.fallbackError ?? <StateView title="Authentication error" subtitle={errorMessage ?? 'Please retry shortly.'} />;

  if (member.is_approved !== true) {
    return fallbacks.fallbackAccessDenied ?? <StateView title="Access denied" subtitle="Your account is not approved for protected modules." />;
  }

  if (allowedRoles && allowedRoles.length > 0 && (!effectiveRole || !allowedRoles.includes(effectiveRole))) {
    return fallbacks.fallbackAccessDenied ?? <StateView title="Role required" subtitle="Your role does not have access to this module." />;
  }

  return <>{children}</>;
}
