'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth, useEffectiveRole } from '@/providers/auth-provider';
import { getNavConfig } from '@/shared/auth/role-nav-config';
import { iconPaths } from '@/shared/design/icon-tokens';

const NAV_STYLE = {
  background: 'linear-gradient(180deg, #1e7a32 0%, #0f4f1f 100%)',
  border: 0,
  borderRadius: 18,
  boxShadow: '0 14px 34px rgba(15, 79, 31, 0.28)',
  padding: 10,
} as const;

function getTabStyle(isActive: boolean) {
  return {
    minHeight: 62,
    display: 'grid',
    placeItems: 'center',
    gap: 3,
    padding: '7px 2px',
    textDecoration: 'none',
    borderRadius: 14,
    background: isActive ? '#FFFFFF' : 'transparent',
    color: isActive ? '#2E7D32' : '#FFFFFF',
    boxShadow: isActive ? '0 8px 20px rgba(0, 0, 0, 0.18)' : 'none',
    fontWeight: 700,
  } as const;
}

function NavIcon({ iconKey }: { iconKey: keyof typeof iconPaths.nav }) {
  const src = iconPaths.nav[iconKey];

  return (
    <span style={{ display: 'block', lineHeight: 1 }} aria-hidden="true">
      <span
        style={{
          display: 'block',
          width: 32,
          height: 32,
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
            <span
              style={{ display: 'block', fontSize: 11, lineHeight: 1.15, whiteSpace: 'nowrap' }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
