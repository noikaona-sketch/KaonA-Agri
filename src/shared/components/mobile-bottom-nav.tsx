"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { iconPaths, iconSizes } from '@/shared/design/icon-tokens';

const tabs = [
  { label: 'สมาชิก', iconSrc: iconPaths.nav.member, href: '/member' },
  { label: 'ผู้ให้บริการ', iconSrc: iconPaths.nav.service, href: '/service' },
  { label: 'ภาคสนาม', iconSrc: iconPaths.nav.field, href: '/field' },
  { label: 'แอดมิน', iconSrc: iconPaths.nav.admin, href: '/admin-prototype' },
] as const;

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number]['label'];
  onTabChange?: (tab: (typeof tabs)[number]['label']) => void;
};

export function MobileBottomNav({ onTabChange }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="เลือกพื้นที่แอปตามบทบาท">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

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
            style={{
              minHeight: 58,
              display: 'grid',
              placeItems: 'center',
              gap: 3,
              padding: '7px 2px',
              textDecoration: 'none',
            }}
            aria-current={isActive ? 'page' : undefined}
            onClick={onTabChange ? () => onTabChange(tab.label) : undefined}
          >
            <span className="mobile-bottom-nav__icon" aria-hidden="true" style={{ display: 'block', lineHeight: 1 }}>
              <img src={tab.iconSrc} alt="" width={iconSizes.nav} height={iconSizes.nav} loading="eager" />
            </span>
            <span
              className="mobile-bottom-nav__label"
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
