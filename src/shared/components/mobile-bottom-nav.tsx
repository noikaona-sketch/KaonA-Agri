"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = ['สมาชิก', 'ผู้ให้บริการ', 'ภาคสนาม', 'แอดมิน'] as const;

const TAB_LINKS: Record<(typeof tabs)[number], string> = {
  สมาชิก: '/member',
  ผู้ให้บริการ: '/service',
  ภาคสนาม: '/field',
  แอดมิน: '/admin-prototype',
};

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number];
  onTabChange?: (tab: (typeof tabs)[number]) => void;
};

export function MobileBottomNav({ onTabChange }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="เลือกพื้นที่แอปตามบทบาท">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={TAB_LINKS[tab]}
          className={[
            'mobile-bottom-nav__item',
            pathname === TAB_LINKS[tab] ? 'mobile-bottom-nav__item--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={pathname === TAB_LINKS[tab] ? 'page' : undefined}
          onClick={onTabChange ? () => onTabChange(tab) : undefined}
        >
          {tab}
        </Link>
      ))}
    </nav>
  );
}
