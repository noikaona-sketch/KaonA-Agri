'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminSeedSuppliers } from '@/features/admin-seed-suppliers/admin-seed-suppliers';
import { AdminSeedVarieties } from '@/features/admin-seed-varieties/admin-seed-varieties';
import { AdminSeedLots } from '@/features/admin-seed-lots/admin-seed-lots';
import { AdminSeedReservations } from '@/features/admin-seed-reservations/admin-seed-reservations';
import { AdminSeedsList } from '@/features/admin-seeds/admin-seeds-list';

type Tab = 'reservations' | 'orders' | 'lots' | 'varieties' | 'suppliers';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'reservations', icon: '📋', label: 'คิวจอง' },
  { key: 'orders',       icon: '🫘', label: 'คำสั่งซื้อ' },
  { key: 'lots',         icon: '🗄️', label: 'Stock LOT' },
  { key: 'varieties',    icon: '🌾', label: 'พันธุ์' },
  { key: 'suppliers',    icon: '🏪', label: 'Supplier' },
];

export default function AdminSeedsPage() {
  const [tab, setTab] = useState<Tab>('reservations');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} เมล็ดพันธุ์ — ${cur.label}`} subtitle="จัดการ Supplier พันธุ์ สต๊อก และการจอง">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'reservations' && <AdminSeedReservations />}
      {tab === 'orders'       && <AdminSeedsList />}
      {tab === 'lots'         && <AdminSeedLots />}
      {tab === 'varieties'    && <AdminSeedVarieties />}
      {tab === 'suppliers'    && <AdminSeedSuppliers />}
    </AdminWebShell>
  );
}
