import type { ReactNode } from 'react';

import { MobileBottomNav } from '@/shared/components/mobile-bottom-nav';
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
          <p className="mobile-shell__kicker">KaonA Agri</p>
          {roleBadge ? <RoleBadge>{roleBadge}</RoleBadge> : null}
        </header>
        <h1 className="mobile-shell__title">{title}</h1>
        <p className="mobile-shell__subtitle">{subtitle}</p>

        <div className="mobile-shell__content">{children}</div>
      </section>
      <MobileBottomNav activeTab="Home" />
    </main>
  );
}
