'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/providers/auth-provider';

type ProtectedRouteStateProps = {
  children: ReactNode;
  fallbackLoading?: ReactNode;
  fallbackUnauthenticated?: ReactNode;
  fallbackError?: ReactNode;
};

function DefaultState({ title, subtitle }: { title: string; subtitle: string }) {
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

export function ProtectedRouteState({
  children,
  fallbackLoading,
  fallbackUnauthenticated,
  fallbackError,
}: ProtectedRouteStateProps) {
  const { status, errorMessage } = useAuth();

  if (status === 'loading') {
    return fallbackLoading ?? (
      <DefaultState title="Checking session" subtitle="Confirming your authentication state." />
    );
  }

  if (status === 'error') {
    return (
      fallbackError ?? (
        <DefaultState
          title="Authentication unavailable"
          subtitle={errorMessage ?? 'Please retry in a moment.'}
        />
      )
    );
  }

  if (status === 'unauthenticated') {
    return (
      fallbackUnauthenticated ?? (
        <DefaultState
          title="Sign-in required"
          subtitle="Please authenticate with LIFF to access protected pages."
        />
      )
    );
  }

  return <>{children}</>;
}
