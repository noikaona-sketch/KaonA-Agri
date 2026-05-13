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
  // สมาชิก
  { label: 'คิวอนุมัติ',     href: '/admin/members/approvals',  icon: '✅' },
  { label: 'สมาชิกทั้งหมด', href: '/admin/members',            icon: '👥' },
  { label: 'จัดการ Role',    href: '/admin/roles',              icon: '🏷️' },
  { label: 'จัดกลุ่ม',      href: '/admin/groups',             icon: '🗂️' },
  { label: 'สร้าง PIN',      href: '/admin/invites',            icon: '🔑' },
  // เกษตร
  { label: 'ภาพรวมฟาร์ม',   href: '/admin/farming',            icon: '🗺️' },
  { label: 'นัดขาย',         href: '/admin/appointments',       icon: '📅' },
  { label: 'แปลงเกษตร',     href: '/admin/plots',              icon: '🌾' },
  { label: 'รอบเพาะปลูก',   href: '/admin/planting',           icon: '🌱' },
  { label: 'งดเผา',          href: '/admin/no-burn',            icon: '🔥' },
  { label: 'งานตรวจ',        href: '/admin/inspections',        icon: '🔍' },
  // ขาย/สต๊อก
  { label: 'POS ขาย/จอง',     href: '/admin/pos',              icon: '💰' },
  { label: 'นัดขายผลผลิต',    href: '/admin/appointments',     icon: '📅' },
  { label: 'นัดรถเกี่ยว',     href: '/admin/harvest',          icon: '🚜' },
  { label: 'คำสั่งซื้อ',      href: '/admin/orders',           icon: '📋' },
  { label: 'สินค้า',           href: '/admin/products',         icon: '🛍️' },
  { label: 'สต๊อก',            href: '/admin/stock',            icon: '📦' },
  { label: 'Supplier เมล็ด',  href: '/admin/seed-suppliers',   icon: '🏪' },
  { label: 'พันธุ์เมล็ด',     href: '/admin/seed-varieties',   icon: '🌾' },
  { label: 'Stock LOT เมล็ด', href: '/admin/seed-lots',         icon: '🗄️' },
  { label: 'คิวจองเมล็ด',    href: '/admin/seed-reservations',  icon: '📋' },
  { label: 'เครดิต/ค้างชำระ', href: '/admin/credit',             icon: '💳' },
  { label: 'เมล็ดพันธุ์',     href: '/admin/seeds',            icon: '🫘' },
  // บริการ/ระบบ
  { label: 'การจองบริการ',   href: '/admin/service',            icon: '🚜' },
  { label: 'เจ้าหน้าที่',   href: '/admin/staff',              icon: '👤' },
];

const DEPT_NAV: Record<string, string[]> = {
  super_admin: ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดการ Role','จัดกลุ่ม','สร้าง PIN','ภาพรวมฟาร์ม','แปลงเกษตร','รอบเพาะปลูก','งดเผา','งานตรวจ','POS ขาย/จอง','นัดขายผลผลิต','นัดรถเกี่ยว','คำสั่งซื้อ','สินค้า','สต๊อก','Supplier เมล็ด','พันธุ์เมล็ด','Stock LOT เมล็ด','คิวจองเมล็ด','เมล็ดพันธุ์','การจองบริการ','เจ้าหน้าที่'],
  admin:       ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดการ Role','จัดกลุ่ม','สร้าง PIN','ภาพรวมฟาร์ม','แปลงเกษตร','รอบเพาะปลูก','งดเผา','งานตรวจ','POS ขาย/จอง','นัดขายผลผลิต','นัดรถเกี่ยว','คำสั่งซื้อ','สินค้า','สต๊อก','Supplier เมล็ด','พันธุ์เมล็ด','Stock LOT เมล็ด','คิวจองเมล็ด','เมล็ดพันธุ์','การจองบริการ','เจ้าหน้าที่'],
  field:       ['แดชบอร์ด','คิวอนุมัติ','สมาชิกทั้งหมด','จัดกลุ่ม','สร้าง PIN','ภาพรวมฟาร์ม','แปลงเกษตร','รอบเพาะปลูก','งดเผา','งานตรวจ','นัดรถเกี่ยว','การจองบริการ'],
  sales:       ['แดชบอร์ด','สมาชิกทั้งหมด','แปลงเกษตร','รอบเพาะปลูก','POS ขาย/จอง','นัดขายผลผลิต','คำสั่งซื้อ','สินค้า','สต๊อก','เมล็ดพันธุ์','การจองบริการ'],
  accounting:  ['แดชบอร์ด','สมาชิกทั้งหมด','คำสั่งซื้อ','สต๊อก','เมล็ดพันธุ์'],
  finance:     ['แดชบอร์ด','สมาชิกทั้งหมด','คำสั่งซื้อ','สต๊อก'],
  stock:       ['แดชบอร์ด','สินค้า','สต๊อก','เมล็ดพันธุ์'],
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
          {navItems.map((item, idx) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            // เพิ่ม divider ก่อน section ใหม่
            const prevItem = navItems[idx - 1];
            const sections: Record<string, string[]> = {
              agri: ['แปลงเกษตร','รอบเพาะปลูก','เมล็ดพันธุ์','งดเผา','งานตรวจ'],
              service: ['การจองบริการ'],
              system: ['เจ้าหน้าที่'],
            };
            const isNewSection = idx > 0 && Object.values(sections).some(
              (s) => s.includes(item.label) && !s.includes(prevItem?.label ?? '')
            );
            return (
              <div key={item.href}>
                {isNewSection && <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '6px 0' }} />}
                <Link
                  href={item.href}
                  className={`admin-web-shell__nav-item${isActive ? ' admin-web-shell__nav-item--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span style={{ marginRight: 8 }}>{item.icon}</span>{item.label}
                </Link>
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 12, paddingTop: 12 }}>
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
