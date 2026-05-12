import Image from 'next/image';
import type { ReactNode } from 'react';

import { MobileBottomNav } from '@/shared/components/mobile-bottom-nav';
import { RoleBadge } from '@/shared/components/role-badge';

type MobileAppShellProps = {
  title: string;
  subtitle: string;
  roleBadge?: string;
  desktopBackoffice?: boolean;
  children?: ReactNode;
};

export function MobileAppShell({ title, subtitle, roleBadge, desktopBackoffice = false, children }: MobileAppShellProps) {
  return (
    <main className={`mobile-shell${desktopBackoffice ? ' mobile-shell--desktop-backoffice' : ''}`}>
      <section className={`mobile-shell__card${desktopBackoffice ? ' mobile-shell__card--desktop-backoffice' : ''}`}>
        <header className="mobile-shell__header">
          <div className="mobile-shell__brand" aria-label="KaonA Agri brand">
            <Image src="/brand/kaona-mark.svg" alt="KaonA mark" width={24} height={24} priority />
            <Image src="/brand/kaona-wordmark.svg" alt="KaonA Agri" width={118} height={28} priority />
          </div>
          {roleBadge ? <RoleBadge>{roleBadge}</RoleBadge> : null}
        </header>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>

        <div className="mobile-shell__content">{children}</div>
      </section>
      <div className={desktopBackoffice ? 'mobile-shell__nav-wrap' : ''}>
        <MobileBottomNav />
      </div>
    </main>
  );
}
