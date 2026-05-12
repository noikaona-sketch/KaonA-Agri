'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RoleBadge } from '@/shared/components/role-badge';

const navItems = [
  { label: 'แดชบอร์ด', href: '/admin' },
  { label: 'คิวอนุมัติ', href: '/admin-prototype/approvals' },
  { label: 'สมาชิก', href: '/admin/members' },
  { label: 'ผู้ให้บริการ', href: '/service' },
  { label: 'ทีมภาคสนาม', href: '/field' },
  { label: 'แปลง', href: '/plots' },
  { label: 'ไม่เผา', href: '/no-burn' },
] as const;

type AdminWebShellProps = {
  title: string;
  subtitle: string;
  roleBadge?: string;
  children: ReactNode;
};

export function AdminWebShell({ title, subtitle, roleBadge = 'แอดมิน', children }: AdminWebShellProps) {
  const pathname = usePathname();

  return (
    <main className="admin-web-shell">
      <aside className="admin-web-shell__sidebar">
        <div className="admin-web-shell__brand" aria-label="KaonA Agri brand">
          <Image src="/brand/kaona-mark.svg" alt="KaonA mark" width={24} height={24} priority />
          <Image src="/brand/kaona-wordmark.svg" alt="KaonA Agri" width={118} height={28} priority />
        </div>

        <nav className="admin-web-shell__nav" aria-label="เมนูหลังบ้าน">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-web-shell__nav-item${isActive ? ' admin-web-shell__nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="admin-web-shell__content-card">
        <header className="admin-web-shell__header">
          <div>
            <h1 className="admin-web-shell__title">{title}</h1>
            <p className="admin-web-shell__subtitle">{subtitle}</p>
          </div>
          <RoleBadge>{roleBadge}</RoleBadge>
        </header>

        <div className="admin-web-shell__content">{children}</div>
      </section>
    </main>
  );
}
