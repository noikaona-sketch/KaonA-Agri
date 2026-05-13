'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

type Stats = {
  members_approved: number; members_pending: number;
  plots_total: number; orders_30d: number; revenue_30d: number;
  reservations_pending: number; stock_low_count: number;
  appointments_upcoming: number;
};

const SECTIONS = [
  {
    title: 'สมาชิก',
    items: [
      { href: '/admin/members/approvals', icon: '✅', label: 'คิวอนุมัติ',     color: '#e8f5e9', border: '#a5d6a7', statKey: 'members_pending', statAlert: true },
      { href: '/admin/members',           icon: '👥', label: 'สมาชิกทั้งหมด', color: '#e3f2fd', border: '#90caf9', statKey: 'members_approved' },
      { href: '/admin/roles',             icon: '🏷️', label: 'จัดการ Role',   color: '#fce4ec', border: '#f48fb1' },
      { href: '/admin/invites',           icon: '🔑', label: 'สร้าง PIN',      color: '#fff8e1', border: '#ffe082' },
      { href: '/admin/staff',             icon: '👤', label: 'เจ้าหน้าที่',   color: '#ede7f6', border: '#b39ddb' },
    ],
  },
  {
    title: 'ขาย / สต๊อก',
    items: [
      { href: '/admin/pos',               icon: '💰', label: 'POS ขาย/จอง',       color: '#e8f5e9', border: '#a5d6a7' },
      { href: '/admin/orders',            icon: '📋', label: 'คำสั่งซื้อ',        color: '#e3f2fd', border: '#90caf9', statKey: 'orders_30d', statSuffix: 'รายการ/30 วัน' },
      { href: '/admin/seed-reservations', icon: '📋', label: 'คิวจองเมล็ด',      color: '#fff8e1', border: '#ffe082', statKey: 'reservations_pending', statAlert: true },
      { href: '/admin/stock',             icon: '📦', label: 'สต๊อก',             color: '#fff3e0', border: '#ffcc80', statKey: 'stock_low_count', statAlert: true, statSuffix: 'ต่ำ' },
      { href: '/admin/seed-suppliers',    icon: '🏪', label: 'Supplier',           color: '#f3e5f5', border: '#ce93d8' },
      { href: '/admin/seed-varieties',    icon: '🌾', label: 'พันธุ์เมล็ด',      color: '#f1f8e9', border: '#c5e1a5' },
      { href: '/admin/seed-lots',         icon: '🗄️', label: 'Stock LOT',         color: '#e8f5e9', border: '#a5d6a7' },
    ],
  },
  {
    title: 'เกษตรกรรม',
    items: [
      { href: '/admin/farming',      icon: '🗺️', label: 'ภาพรวมฟาร์ม',   color: '#e8f5e9', border: '#a5d6a7', statKey: 'plots_total', statSuffix: 'แปลง' },
      { href: '/admin/appointments', icon: '📅', label: 'นัดขาย',          color: '#fff8e1', border: '#ffe082', statKey: 'appointments_upcoming', statAlert: false },
      { href: '/admin/plots',        icon: '🌾', label: 'แปลงเกษตร',       color: '#f1f8e9', border: '#c5e1a5' },
      { href: '/admin/planting',     icon: '🌱', label: 'รอบเพาะปลูก',    color: '#e8f5e9', border: '#a5d6a7' },
      { href: '/admin/no-burn',      icon: '🔥', label: 'งดเผา',            color: '#fff8e1', border: '#ffe082' },
      { href: '/admin/inspections',  icon: '🔍', label: 'งานตรวจ',          color: '#e3f2fd', border: '#90caf9' },
      { href: '/admin/service',      icon: '🚜', label: 'การจองบริการ',     color: '#e0f2f1', border: '#80cbc4' },
    ],
  },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void fetch('/api/admin/dashboard-stats')
      .then((r) => r.json())
      .then((d) => setStats(d as Stats));
  }, []);

  function statLabel(key?: string, suffix?: string, alert?: boolean): string | null {
    if (!key || !stats) return null;
    const val = stats[key as keyof Stats];
    if (typeof val !== 'number') return null;
    if (val === 0 && alert) return null;
    if (key === 'revenue_30d') return `฿${(val / 1000).toFixed(0)}K`;
    return `${val.toLocaleString()}${suffix ? ' ' + suffix : ''}`;
  }

  return (
    <AdminWebShell title="แดชบอร์ด" subtitle="ภาพรวมระบบ KaonA Agri">

      {/* Revenue banner */}
      {stats && stats.revenue_30d > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', borderRadius: 16, padding: '16px 20px', marginBottom: 24, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>ยอดขาย 30 วันที่ผ่านมา</p>
            <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900 }}>฿{stats.revenue_30d.toLocaleString()}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>{stats.orders_30d} คำสั่ง</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>{stats.members_approved} สมาชิก</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 32 }}>
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6741' }}>
              {section.title}
            </h2>
            <div className="admin-kpi-grid">
              {section.items.map((item) => {
                const label = statLabel(item.statKey, item.statSuffix, item.statAlert);
                const isAlert = item.statAlert && label;
                return (
                  <Link key={item.href} href={item.href} className="admin-kpi-card"
                    style={{ borderColor: isAlert ? '#ef9a9a' : item.border, background: isAlert ? '#ffebee' : item.color, position: 'relative' }}>
                    <div className="admin-kpi-icon">{item.icon}</div>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#1a1f1c' }}>{item.label}</p>
                    {label && (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isAlert ? '#c62828' : '#2e7d32' }}>
                        {label}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminWebShell>
  );
}
