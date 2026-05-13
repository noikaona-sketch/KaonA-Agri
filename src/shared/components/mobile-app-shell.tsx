import Image from 'next/image';
import type { ReactNode } from 'react';

import { MobileBottomNav } from '@/shared/components/mobile-bottom-nav';
import { NotificationBell } from '@/shared/components/notification-bell';
import { RoleBadge } from '@/shared/components/role-badge';

type MobileAppShellProps = {
  title: string;
  subtitle: string;
  roleBadge?: string;
  children?: ReactNode;
};

export function MobileAppShell({ title, subtitle, roleBadge, children }: MobileAppShellProps) {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <header className="mobile-shell__header">
          <div className="mobile-shell__brand" aria-label="KaonA Agri brand">
            <Image src="/brand/kaona-mark.svg" alt="KaonA mark" width={24} height={24} priority />
            <Image src="/brand/kaona-wordmark.svg" alt="KaonA Agri" width={118} height={28} priority />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {roleBadge ? <RoleBadge>{roleBadge}</RoleBadge> : null}
            <NotificationBell />
          </div>
        </header>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>

        <div className="mobile-shell__content">{children}</div>
      </section>
      <MobileBottomNav />
    </main>
  );
}
