"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'สมาชิก', icon: '👤', href: '/member' },
  { label: 'ผู้ให้บริการ', icon: '🚜', href: '/service' },
  { label: 'ภาคสนาม', icon: '📍', href: '/field' },
  { label: 'แอดมิน', icon: '📊', href: '/admin-prototype' },
] as const;

type MobileBottomNavProps = {
  activeTab?: (typeof tabs)[number]['label'];
  onTabChange?: (tab: (typeof tabs)[number]['label']) => void;
};

export function MobileBottomNav({ onTabChange }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="เลือกพื้นที่แอปตามบทบาท">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={[
            'mobile-bottom-nav__item',
            pathname === tab.href ? 'mobile-bottom-nav__item--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={pathname === tab.href ? 'page' : undefined}
          onClick={onTabChange ? () => onTabChange(tab.label) : undefined}
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="mobile-bottom-nav__label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
