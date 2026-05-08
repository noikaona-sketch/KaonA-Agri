'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type GlobalRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalRouteError({ error, reset }: GlobalRouteErrorProps) {
  useEffect(() => {
    console.error('Unhandled route error', error);
  }, [error]);

  return (
    <main className="mobile-shell">
      <ErrorState title="Application error" detail="An unexpected error occurred. Please try again." />
      <div className="mobile-shell__card" style={{ marginTop: 12 }}>
        <UIButton fullWidth onClick={reset}>
          Retry
        </UIButton>
      </div>
    </main>
  );
}
