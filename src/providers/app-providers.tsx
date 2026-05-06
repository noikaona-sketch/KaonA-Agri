'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { initLiff } from '@/lib/liff/init-liff';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    void initLiff();
  }, []);

  return <>{children}</>;
}
