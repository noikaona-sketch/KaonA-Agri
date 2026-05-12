import Link from 'next/link';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

const QUICK_LINKS = [
  { href: '/admin/members/approvals', icon: '✅', label: 'คิวอนุมัติ',     color: '#e8f5e9', border: '#a5d6a7' },
  { href: '/admin/members',           icon: '👥', label: 'สมาชิก',         color: '#e3f2fd', border: '#90caf9' },
  { href: '/admin/roles',             icon: '🏷️', label: 'จัดการ Role',   color: '#fce4ec', border: '#f48fb1' },
  { href: '/admin/invites',           icon: '🔑', label: 'สร้าง PIN',      color: '#fff8e1', border: '#ffe082' },
  { href: '/admin/groups',            icon: '🗂️', label: 'จัดกลุ่ม',     color: '#f3e5f5', border: '#ce93d8' },
  { href: '/admin/staff',             icon: '👤', label: 'เจ้าหน้าที่',   color: '#e0f2f1', border: '#80cbc4' },
];

export default function AdminDashboardPage() {
  return (
    <AdminWebShell title="แดชบอร์ด" subtitle="ภาพรวมระบบหลังบ้าน KaonA Agri">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: item.color, border: `1.5px solid ${item.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', transition: 'transform 0.15s', cursor: 'pointer' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1f1c' }}>{item.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </AdminWebShell>
  );
}
