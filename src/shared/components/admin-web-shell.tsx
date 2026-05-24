'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type NavItem = { label: string; href: string; icon: string };

// เมนูหลัก — กระชับ ใช้ tab ในหน้าแทนการแตก nav
const ALL_NAV: NavItem[] = [
  { label: 'แดชบอร์ด', href: '/admin',          icon: '📊' },
  { label: 'สมาชิก',   href: '/admin/members',   icon: '👥' },
  { label: 'เกษตร',    href: '/admin/farming',   icon: '🗺️' },
  { label: 'เมล็ด',    href: '/admin/seeds',     icon: '🌾' },
  { label: 'ขาย',      href: '/admin/sales',     icon: '💰' },
  { label: 'คลัง',     href: '/admin/stock',     icon: '📦' },
  { label: 'รถเกี่ยว',    href: '/admin/harvest',  icon: '🚜' },
  { label: 'รายงาน',   href: '/admin/reports',  icon: '📈' },
  { label: 'คะแนนบริการ', href: '/admin/ratings',  icon: '⭐' },
  { label: 'เครดิต',   href: '/admin/credit',    icon: '💳' },
  { label: 'บริการ',   href: '/admin/service',   icon: '🔧' },
  { label: 'เจ้าหน้าที่', href: '/admin/staff',  icon: '👤' },
  { label: 'สื่อสาร', href: '/admin/campaigns', icon: '📢' },
  { label: 'แบบสำรวจ', href: '/admin/surveys', icon: '📝' },
  { label: 'แจ้งเตือน', href: '/admin/alerts', icon: '🚨' },
  { label: 'System Map', href: '/admin/system-map', icon: '🗺️' },
  { label: 'UAT',        href: '/admin/uat',        icon: '🧪' },
];

const DEPT_NAV: Record<string, string[]> = {
  super_admin: ['แดชบอร์ด','สมาชิก','เกษตร','เมล็ด','ขาย','คลัง','รถเกี่ยว','รายงาน','คะแนนบริการ','เครดิต','บริการ','เจ้าหน้าที่','สื่อสาร','แบบสำรวจ','แจ้งเตือน','System Map'],
  admin:       ['แดชบอร์ด','สมาชิก','เกษตร','เมล็ด','ขาย','คลัง','รถเกี่ยว','คะแนนบริการ','เครดิต','บริการ','สื่อสาร','แบบสำรวจ','แจ้งเตือน','System Map'],
  field:       ['แดชบอร์ด','สมาชิก','เกษตร','รถเกี่ยว','คะแนนบริการ','บริการ','สื่อสาร','แบบสำรวจ','แจ้งเตือน'],
  sales:       ['แดชบอร์ด','สมาชิก','เมล็ด','ขาย','คลัง','เครดิต','สื่อสาร','แบบสำรวจ','แจ้งเตือน'],
  accounting:  ['แดชบอร์ด','ขาย','คลัง','เครดิต','สื่อสาร','แบบสำรวจ','แจ้งเตือน'],
  finance:     ['แดชบอร์ด','ขาย','คลัง','เครดิต','สื่อสาร','แบบสำรวจ','แจ้งเตือน'],
  stock:       ['แดชบอร์ด','เมล็ด','ขาย','คลัง','สื่อสาร','แบบสำรวจ','แจ้งเตือน'],
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

  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    // Read department + admin_role from cookies (non-httpOnly, set at login)
    const cookies = document.cookie.split(';').map((c) => c.trim());
    const deptVal = cookies.find((c) => c.startsWith('kaona_admin_dept='));
    if (deptVal) setDept(deptVal.split('=')[1]?.trim() ?? 'admin');
    const roleVal = cookies.find((c) => c.startsWith('kaona_admin_role='));
    if (roleVal) setAdminRole(roleVal.split('=')[1]?.trim() ?? null);
  }, []);

  // visibleMenus = allMenus.filter(canAccess)
  // admin_role (from admin_role_permissions table) adds a second filter layer.
  // super_admin sees all menus. Other roles filtered by DEPT_NAV first,
  // then restricted further if admin_role limits specific menus.
  const ROLE_EXTRA_HIDDEN: Record<string, string[]> = {
    // field_admin should not see financial menus even if dept allows it
    field_admin:    ['เครดิต', 'ขาย'],
    // seed_admin should not see harvest or financial menus
    seed_admin:     ['รถเกี่ยว', 'เครดิต'],
    // readonly_admin sees everything their dept allows but nothing is hidden further
    readonly_admin: [],
  };
  const extraHidden = adminRole ? (ROLE_EXTRA_HIDDEN[adminRole] ?? []) : [];
  const navItems = getNavForDept(dept).filter((n) => !extraHidden.includes(n.label));
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
                <span className="admin-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-nav-logout">
          <Link href="/api/admin-auth/logout"
            className="admin-web-shell__nav-item"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="admin-nav-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>🚪</span>
            ออกจากระบบ
          </Link>
        </div>
      </aside>

      <section className="admin-web-shell__content-card">
        <header className="admin-web-shell__header">
          <div>
            <h1 className="admin-web-shell__title">{title}</h1>
            <p className="admin-web-shell__subtitle">{subtitle}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: '#e8f5e9', color: '#1b5e20', border: '1.5px solid #a5d6a7', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
            {roleBadge ?? deptLabel[dept] ?? dept}
          </span>
        </header>
        <div className="admin-web-shell__content">{children}</div>
      </section>
    </main>
  );
}
