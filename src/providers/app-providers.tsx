'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { initLiff } from '@/lib/liff/init-liff';
import { AuthProvider } from '@/providers/auth-provider';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    void initLiff().catch((error: unknown) => {
      console.warn('LIFF initialization skipped or failed.', error);
    });
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
