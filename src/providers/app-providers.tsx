'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { initLiff } from '@/lib/liff/init-liff';
import { AuthProvider } from '@/providers/auth-provider';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const pathname = usePathname();
  const shouldBypassLineAuth = pathname === '/admin-login' || pathname === '/admin' || pathname.startsWith('/admin-prototype');

  useEffect(() => {
    if (shouldBypassLineAuth) {
      return;
    }

    void initLiff().catch((error: unknown) => {
      console.warn('LIFF initialization skipped or failed.', error);
    });
  }, [shouldBypassLineAuth]);

  return <AuthProvider>{children}</AuthProvider>;
}
