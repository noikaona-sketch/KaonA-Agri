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

const MENU = [
  {
    href: '/admin/members', icon: '👥', label: 'สมาชิก',
    desc: 'อนุมัติ · Role · กลุ่ม · PIN',
    color: '#e8f5e9', border: '#a5d6a7', statKey: 'members_pending', statAlert: true, statSuffix: 'รออนุมัติ',
  },
  {
    href: '/admin/farming', icon: '🗺️', label: 'เกษตร',
    desc: 'แผนที่ · แปลง · รอบปลูก · งดเผา · ตรวจ',
    color: '#f1f8e9', border: '#c5e1a5', statKey: 'plots_total', statSuffix: 'แปลง',
  },
  {
    href: '/admin/seeds', icon: '🌾', label: 'เมล็ดพันธุ์',
    desc: 'Supplier · พันธุ์ · Stock · จอง · คำสั่ง',
    color: '#fff8e1', border: '#ffe082', statKey: 'reservations_pending', statAlert: true, statSuffix: 'รอดำเนินการ',
  },
  {
    href: '/admin/sales', icon: '💰', label: 'ขาย/สต๊อก',
    desc: 'POS · คำสั่งซื้อ · นัดขาย · สินค้า · สต๊อก',
    color: '#e3f2fd', border: '#90caf9', statKey: 'orders_30d', statSuffix: 'คำสั่ง/30วัน',
  },
  {
    href: '/admin/harvest', icon: '🚜', label: 'รถเกี่ยว',
    desc: 'นัดรถ · ติดตาม · บันทึกผล',
    color: '#e0f2f1', border: '#80cbc4',
  },
  {
    href: '/admin/credit', icon: '💳', label: 'เครดิต',
    desc: 'ยอดค้างชำระ · รับชำระ · เติมเครดิต',
    color: '#fce4ec', border: '#f48fb1',
  },
  {
    href: '/admin/service', icon: '🔧', label: 'บริการ',
    desc: 'จองบริการ · มอบหมายงาน',
    color: '#ede7f6', border: '#b39ddb',
  },
  {
    href: '/admin/staff', icon: '👤', label: 'เจ้าหน้าที่',
    desc: 'จัดการทีมงาน',
    color: '#f5f5f5', border: '#e0e0e0',
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

      {/* Menu grid */}
      <div className="admin-kpi-grid">
        {MENU.map((item) => {
          const label = statLabel(item.statKey, item.statSuffix, item.statAlert);
          const isAlert = item.statAlert && label;
          return (
            <Link key={item.href} href={item.href} className="admin-kpi-card"
              style={{ borderColor: isAlert ? '#ef9a9a' : item.border, background: isAlert ? '#ffebee' : item.color }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{item.icon}</div>
              <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#1a1f1c' }}>{item.label}</p>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{item.desc}</p>
              {label && (
                <span style={{ fontSize: 13, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: isAlert ? '#c62828' : '#2e7d32', color: '#fff' }}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </AdminWebShell>
  );
}
