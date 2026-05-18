'use client';

import Link from 'next/link';
import { useEffectiveRole } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServicePage() {
  const role = useEffectiveRole();

  return (
    <MobileAppShell title="บริการ" subtitle="สั่งซื้อสินค้าและจองบริการ">
      <div className="mobile-stack">
        <div className="home-actions">
          {[
            { href: '/service/booking',          icon: '🛍️', label: 'สั่งซื้อ/จอง',   desc: 'เมล็ดพันธุ์และสินค้า', accent: true },
            { href: '/service/service-booking',  icon: '🚜', label: 'จองบริการ',       desc: 'รถไถ · รถเกี่ยว · รถขนส่ง' },
            { href: '/planting-cycles',          icon: '🌱', label: 'รอบเพาะปลูก',    desc: 'บันทึกความคืบหน้า' },
            { href: '/no-burn',                  icon: '🔥', label: 'งดเผา',           desc: 'ยื่นคำของดเผา' },
            ...(role === 'truck_owner' ? [
              { href: '/service',       icon: '🚛', label: 'งานขนส่ง',       desc: 'รับและจัดการงาน' },
            ] : []),
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className={`home-action-card${item.accent ? ' home-action-card--accent' : ''}`}>
              <span className="home-action-card__icon">{item.icon}</span>
              <p className="home-action-card__label">{item.label}</p>
              <p className="home-action-card__desc">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </MobileAppShell>
  );
}
