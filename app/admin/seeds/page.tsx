'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminSeedLots } from '@/features/admin-seed-lots/admin-seed-lots';
import { AdminSeedVarieties } from '@/features/admin-seed-varieties/admin-seed-varieties';
import { AdminSeedSuppliers } from '@/features/admin-seed-suppliers/admin-seed-suppliers';
import { StockMovementPanel } from '@/features/admin-stock-movements/stock-movement-panel';

type Tab = 'lots' | 'movements' | 'varieties' | 'suppliers';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'lots',      icon: '🗄️', label: 'Stock LOT' },
  { key: 'movements', icon: '📊', label: 'เคลื่อนไหว' },
  { key: 'varieties', icon: '🌾', label: 'พันธุ์' },
  { key: 'suppliers', icon: '🏪', label: 'Supplier' },
];

export default function AdminSeedsPage() {
  const [tab, setTab] = useState<Tab>('lots');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} เมล็ดพันธุ์ — ${cur.label}`} subtitle="จัดการ Supplier พันธุ์ และ Stock LOT">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'lots'      && <AdminSeedLots />}
      {tab === 'movements' && <StockMovementPanel />}
      {tab === 'varieties' && <AdminSeedVarieties />}
      {tab === 'suppliers' && <AdminSeedSuppliers />}
    </AdminWebShell>
  );
}
