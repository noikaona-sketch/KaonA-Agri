'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth, useEffectiveRole } from '@/providers/auth-provider';
import { getNavConfig } from '@/shared/auth/role-nav-config';
import { iconPaths } from '@/shared/design/icon-tokens';

const NAV_STYLE = {
  background: 'linear-gradient(180deg, #1e7a32 0%, #0f4f1f 100%)',
  border: 0,
  borderRadius: 14,
  boxShadow: '0 4px 16px rgba(15, 79, 31, 0.25)',
  padding: '4px 2px',
} as const;

function getTabStyle(isActive: boolean) {
  return {
    minHeight: 44,
    display: 'grid',
    placeItems: 'center',
    gap: 1,
    padding: '4px 2px',
    textDecoration: 'none',
    borderRadius: 10,
    background: isActive ? '#FFFFFF' : 'transparent',
    color: isActive ? '#2E7D32' : '#FFFFFF',
    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
    fontWeight: 700,
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
          </Link>
        );
      })}
    </nav>
  );
}
