'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { AdminPermission, AdminRole } from '@/shared/auth/admin-permissions';

// ── Menu definitions with required permission ──────────────────────────
type NavItem = {
  label:      string;
  href:       string;
  icon:       string;
  permission: AdminPermission | 'always'; // 'always' = ดูได้ทุก role
};

const ALL_NAV: NavItem[] = [
  { label: 'แดชบอร์ด',    href: '/admin',           icon: '📊', permission: 'always' },
  { label: 'สมาชิก',      href: '/admin/members',    icon: '👥', permission: 'members.read' },
  { label: 'เกษตร',       href: '/admin/farming',    icon: '🗺️', permission: 'field.read' },
  { label: 'เมล็ด',       href: '/admin/seeds',      icon: '🌾', permission: 'seed.read' },
  { label: 'ขาย',         href: '/admin/sales',      icon: '💰', permission: 'service.read' },
  { label: 'คลัง',        href: '/admin/stock',      icon: '📦', permission: 'seed.read' },
  { label: 'รถเกี่ยว',    href: '/admin/harvest',    icon: '🚜', permission: 'service.read' },
  { label: 'คะแนนบริการ', href: '/admin/ratings',    icon: '⭐', permission: 'service.read' },
  { label: 'เครดิต',      href: '/admin/credit',     icon: '💳', permission: 'finance.read' },
  { label: 'บริการ',      href: '/admin/service',    icon: '🔧', permission: 'service.read' },
  { label: 'เจ้าหน้าที่', href: '/admin/staff',      icon: '👤', permission: 'admin_users.manage' },
];

// ── Admin identity from /api/admin/me ──────────────────────────────────
type AdminMe = {
  authenticated: boolean;
  email:       string | null;
  department:  string | null;
  adminRole:   AdminRole;
  permissions: AdminPermission[];
};

const ROLE_LABEL: Record<string, string> = {
  super_admin:   '⚙️ Super Admin',
  member_admin:  '👥 Member Admin',
  field_admin:   '🔍 Field Admin',
  market_admin:  '💰 Market Admin',
  service_admin: '🚛 Service Admin',
  seed_admin:    '🌽 Seed Admin',
  finance_admin: '💳 Finance Admin',
  readonly_admin:'👁️ Readonly',
};

// Fallback dept label for legacy display
const DEPT_LABEL: Record<string, string> = {
  admin: 'แอดมิน', field: 'ภาคสนาม', sales: 'ฝ่ายขาย',
  accounting: 'บัญชี', finance: 'การเงิน', stock: 'สต๊อก',
  member: 'สมาชิก', market: 'ราคา', service: 'บริการ', seed: 'เมล็ด',
};

type AdminWebShellProps = {
  title:     string;
  subtitle:  string;
  roleBadge?: string;
  children:  ReactNode;
};

export function AdminWebShell({ title, subtitle, roleBadge, children }: AdminWebShellProps) {
  const pathname = usePathname();
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    void fetch('/api/admin/me').then(async (res) => {
      if (!res.ok) return;
      setMe((await res.json()) as AdminMe);
    }).catch(() => null);
  }, []);

  // Filter nav by permission
  const navItems = ALL_NAV.filter((item) => {
    if (item.permission === 'always') return true;
    if (!me) return false;
    return me.permissions.includes(item.permission);
  });

  const displayRole = me ? (ROLE_LABEL[me.adminRole] ?? me.adminRole) : '…';
  const displayDept = me?.department ? (DEPT_LABEL[me.department] ?? me.department) : '';

  return (
    <main className="admin-web-shell">
      <aside className="admin-web-shell__sidebar">
        <div className="admin-web-shell__brand">
          <Image src="/brand/kaona-mark.svg"     alt="KaonA mark"  width={24}  height={24}  priority />
          <Image src="/brand/kaona-wordmark.svg"  alt="KaonA Agri"  width={118} height={28}  priority />
        </div>

        {me && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#9de8b0', fontWeight: 600, letterSpacing: 1 }}>
              {displayRole}
            </p>
            {displayDept && (
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {displayDept}
              </p>
            )}
          </div>
        )}

        <nav className="admin-web-shell__nav" aria-label="เมนูหลังบ้าน">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`admin-web-shell__nav-item${isActive ? ' admin-web-shell__nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}>
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
            {roleBadge ?? displayRole}
          </span>
        </header>
        <div className="admin-web-shell__content">{children}</div>
      </section>
    </main>
  );
}
