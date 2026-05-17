'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth, useEffectiveRole } from '@/providers/auth-provider';
import { getNavConfig } from '@/shared/auth/role-nav-config';
import { iconPaths } from '@/shared/design/icon-tokens';

const NAV_STYLE = {
  background: 'var(--color-background-primary, #fff)',
  border: 0,
  borderTop: '0.5px solid var(--color-border-tertiary, #e4ede4)',
  borderRadius: 0,
  boxShadow: 'none',
  padding: '4px 8px 8px',
} as const;

function getTabStyle(isActive: boolean) {
  return {
    minHeight: 48,
    display: 'grid',
    placeItems: 'center',
    gap: 2,
    padding: '6px 4px',
    textDecoration: 'none',
    borderRadius: 10,
    background: 'transparent',
    color: isActive
      ? 'var(--color-text-primary, #111)'
      : 'var(--color-text-secondary, #888)',
    boxShadow: 'none',
    fontWeight: isActive ? 500 : 400,
  } as const;
}

function NavIcon({ iconKey }: { iconKey: string }) {
  // ถ้าเป็น emoji (unicode) → แสดงโดยตรง
  const isEmoji = /\p{Emoji}/u.test(iconKey) && !['member','field','service','admin'].includes(iconKey);
  if (isEmoji) {
    return (
      <span style={{ display: 'block', lineHeight: 1, fontSize: 20, textAlign: 'center' }} aria-hidden="true">
        {iconKey}
      </span>
    );
  }

  // SVG mask icon เดิม
  const src = iconPaths.nav[iconKey as keyof typeof iconPaths.nav] ?? iconPaths.nav.member;
  return (
    <span style={{ display: 'block', lineHeight: 1 }} aria-hidden="true">
      <span
        style={{
          display: 'block', width: 32, height: 32,
          backgroundColor: 'currentColor',
          WebkitMask: `url(${src}) center / contain no-repeat`,
          mask: `url(${src}) center / contain no-repeat`,
        }}
      />
    </span>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { status } = useAuth();
  const effectiveRole = useEffectiveRole();
  const { tabs } = getNavConfig(status, effectiveRole, pathname);

  return (
    <nav className="mobile-bottom-nav" aria-label="เมนูหลัก" style={NAV_STYLE}>
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/'
            ? pathname === '/'   // home ต้อง exact match เท่านั้น
            : pathname === tab.href || pathname.startsWith(tab.href + '/');

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'mobile-bottom-nav__item',
              isActive ? 'mobile-bottom-nav__item--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={getTabStyle(isActive)}
            aria-current={isActive ? 'page' : undefined}
          >
            <NavIcon iconKey={tab.iconKey} />
            <span style={{ display: 'block', fontSize: 10, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {tab.label}
            </span>
            {isActive && (
              <span style={{ display: 'block', width: 4, height: 4, borderRadius: '50%', background: '#3B6D11', margin: '0 auto' }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
