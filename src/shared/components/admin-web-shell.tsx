'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type NavItem = { label: string; href: string; icon: string };

// เมนูตาม permission
const ALL_NAV: NavItem[] = [
  { label: 'แดชบอร์ด',       href: '/admin',                    icon: '📊' },
  { label: 'คิวอนุมัติ',     href: '/admin/members/approvals',  icon: '✅' },
  { label: 'สมาชิกทั้งหมด', href: '/admin/members',            icon: '👥' },
  { label: 'จัดการ Role',    href: '/admin/roles',              icon: '🏷️' },
  { label: 'จัดกลุ่ม',      href: '/admin/groups',             icon: '🗂️' },
  { label: 'สร้าง PIN',      href: '/admin/invites',            icon: '🔑' },
  { label: 'เจ้าหน้าที่',   href: '/admin/staff',              icon: '👤' },
];

const DEPT_NAV: Record<string, string[]> = {
  super_admin: ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดการ Role','จัดกลุ่ม','สร้าง PIN','เจ้าหน้าที่'],
  admin:       ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดการ Role','จัดกลุ่ม','สร้าง PIN','เจ้าหน้าที่'],
  field:       ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดกลุ่ม','สร้าง PIN'],
  sales:       ['แดชบอร์ด','สมาชิกทั้งหมด'],
  accounting:  ['แดชบอร์ด','สมาชิกทั้งหมด'],
  finance:     ['แดชบอร์ด','สมาชิกทั้งหมด'],
  stock:       ['แดชบอร์ด','สมาชิกทั้งหมด'],
};

function getNavForDept(dept: string): NavItem[] {
  const allowed = DEPT_NAV[dept] ?? DEPT_NAV.sales;
  return ALL_NAV.filter((n) => allowed.includes(n.label));
}

type AdminWebShellProps = {
  title: string;
  subtitle: string;
  roleBadge?: string;
  children: ReactNode;
};

export function AdminWebShell({ title, subtitle, roleBadge, children }: AdminWebShellProps) {
  const pathname = usePathname();
  const [dept, setDept] = useState('admin');

  useEffect(() => {
    // อ่าน department จาก cookie (non-httpOnly)
    const val = document.cookie.split(';').find((c) => c.trim().startsWith('kaona_admin_dept='));
    if (val) setDept(val.split('=')[1]?.trim() ?? 'admin');
  }, []);

  const navItems = getNavForDept(dept);
  const deptLabel: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'แอดมิน', field: 'ภาคสนาม',
    sales: 'ฝ่ายขาย', accounting: 'บัญชี', finance: 'การเงิน', stock: 'สต๊อก',
  };

  return (
    <main className="admin-web-shell">
      <aside className="admin-web-shell__sidebar">
        <div className="admin-web-shell__brand">
          <Image src="/brand/kaona-mark.svg" alt="KaonA mark" width={24} height={24} priority />
          <Image src="/brand/kaona-wordmark.svg" alt="KaonA Agri" width={118} height={28} priority />
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#9de8b0', fontWeight: 600, letterSpacing: 1 }}>
          {deptLabel[dept] ?? dept}
        </p>

        <nav className="admin-web-shell__nav" aria-label="เมนูหลังบ้าน">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-web-shell__nav-item${isActive ? ' admin-web-shell__nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span style={{ marginRight: 8 }}>{item.icon}</span>{item.label}
              </Link>
            );
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 12, paddingTop: 12 }}>
            <Link href="/api/admin-auth/logout" className="admin-web-shell__nav-item" style={{ color: '#fca5a5' }}>
              <span style={{ marginRight: 8 }}>🚪</span>ออกจากระบบ
            </Link>
          </div>
        </nav>
      </aside>

      <section className="admin-web-shell__content-card">
        <header className="admin-web-shell__header">
          <div>
            <h1 className="admin-web-shell__title">{title}</h1>
            <p className="admin-web-shell__subtitle">{subtitle}</p>
          </div>
          {roleBadge && <span className="role-badge">{roleBadge ?? deptLabel[dept]}</span>}
        </header>
        <div className="admin-web-shell__content">{children}</div>
      </section>
    </main>
  );
}
