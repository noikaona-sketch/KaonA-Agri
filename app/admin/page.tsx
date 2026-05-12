import Link from 'next/link';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

const SECTIONS = [
  {
    title: 'สมาชิก',
    items: [
      { href: '/admin/members/approvals', icon: '✅', label: 'คิวอนุมัติ',     color: '#e8f5e9', border: '#a5d6a7' },
      { href: '/admin/members',           icon: '👥', label: 'สมาชิกทั้งหมด', color: '#e3f2fd', border: '#90caf9' },
      { href: '/admin/roles',             icon: '🏷️', label: 'จัดการ Role',   color: '#fce4ec', border: '#f48fb1' },
      { href: '/admin/invites',           icon: '🔑', label: 'สร้าง PIN',      color: '#fff8e1', border: '#ffe082' },
      { href: '/admin/groups',            icon: '🗂️', label: 'จัดกลุ่ม',     color: '#f3e5f5', border: '#ce93d8' },
    ],
  },
  {
    title: 'ขาย / สต๊อก',
    items: [
      { href: '/admin/pos',      icon: '💰', label: 'POS ขาย/จอง',  color: '#e8f5e9', border: '#a5d6a7' },
      { href: '/admin/orders',   icon: '📋', label: 'คำสั่งซื้อ',   color: '#e3f2fd', border: '#90caf9' },
      { href: '/admin/products', icon: '🛍️', label: 'จัดการสินค้า', color: '#fff8e1', border: '#ffe082' },
      { href: '/admin/stock',    icon: '📦', label: 'สต๊อก',         color: '#fff3e0', border: '#ffcc80' },
    ],
  },
  {
    title: 'เกษตรกรรม',
    items: [
      { href: '/admin/plots',       icon: '🌾', label: 'แปลงเกษตร',   color: '#e8f5e9', border: '#a5d6a7' },
      { href: '/admin/planting',    icon: '🌱', label: 'รอบเพาะปลูก', color: '#f1f8e9', border: '#c5e1a5' },
      { href: '/admin/seeds',       icon: '🫘', label: 'เมล็ดพันธุ์',  color: '#fff3e0', border: '#ffcc80' },
      { href: '/admin/no-burn',     icon: '🔥', label: 'งดเผา',        color: '#fff8e1', border: '#ffe082' },
      { href: '/admin/inspections', icon: '🔍', label: 'งานตรวจ',      color: '#e3f2fd', border: '#90caf9' },
    ],
  },
  {
    title: 'บริการ & ระบบ',
    items: [
      { href: '/admin/service', icon: '🚜', label: 'การจองบริการ', color: '#e0f2f1', border: '#80cbc4' },
      { href: '/admin/staff',   icon: '👤', label: 'เจ้าหน้าที่',  color: '#ede7f6', border: '#b39ddb' },
    ],
  },
];

export default function AdminDashboardPage() {
  return (
    <AdminWebShell title="แดชบอร์ด" subtitle="ภาพรวมระบบหลังบ้าน KaonA Agri">
      <div style={{ display: 'grid', gap: 28 }}>
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a6741' }}>
              {section.title}
            </h2>
            <div className="admin-kpi-grid">
              {section.items.map((item) => (
                <Link key={item.href} href={item.href} className="admin-kpi-card" style={{ borderColor: item.border, background: item.color }}>
                  <div className="admin-kpi-icon">{item.icon}</div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1f1c' }}>{item.label}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminWebShell>
  );
}
