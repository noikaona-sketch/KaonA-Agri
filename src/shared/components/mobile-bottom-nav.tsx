"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AdminNavIcon, FieldNavIcon, MemberNavIcon, ServiceNavIcon } from '@/shared/components/kaona-icons';

const tabs = [
  { label: 'สมาชิก', icon: MemberNavIcon, href: '/member' },
  { label: 'ผู้ให้บริการ', icon: ServiceNavIcon, href: '/service' },
  { label: 'ภาคสนาม', icon: FieldNavIcon, href: '/field' },
  { label: 'แอดมิน', icon: AdminNavIcon, href: '/admin-prototype' },
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
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'mobile-bottom-nav__item',
              pathname === tab.href ? 'mobile-bottom-nav__item--active' : '',
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
            aria-current={pathname === tab.href ? 'page' : undefined}
            onClick={onTabChange ? () => onTabChange(tab.label) : undefined}
          >
            <span className="mobile-bottom-nav__icon" aria-hidden="true" style={{ display: 'block', lineHeight: 1 }}>
              <Icon width={22} height={22} />
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
