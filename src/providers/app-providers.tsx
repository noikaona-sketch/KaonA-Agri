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
    void initLiff().catch(() => {
      console.warn('LIFF initialization skipped or failed.');
    });
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
