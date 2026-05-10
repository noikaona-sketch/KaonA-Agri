import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppProviders } from '@/providers/app-providers';

import './globals.css';
import './kaona-ui.css';

export const metadata: Metadata = {
  title: 'KaonA Agri',
  description: 'Mobile-first field app scaffold for LINE LIFF + Supabase.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
