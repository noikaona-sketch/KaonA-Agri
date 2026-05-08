'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { ensureLiffSignedIn } from '@/lib/liff/init-liff';
import { AuthProvider } from '@/providers/auth-provider';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    void ensureLiffSignedIn().catch(() => {
      console.warn('LIFF initialization skipped or failed.');
    });
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
