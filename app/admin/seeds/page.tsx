'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminPickupSlots } from '@/features/admin-seed-lots/admin-pickup-slots';
import { AdminSeedVarieties } from '@/features/admin-seed-varieties/admin-seed-varieties';
import { AdminSeedSuppliers } from '@/features/admin-seed-suppliers/admin-seed-suppliers';
import { StockMovementPanel } from '@/features/admin-stock-movements/stock-movement-panel';

type Tab = 'movements' | 'pickup' | 'varieties' | 'suppliers';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'movements', icon: '📊', label: 'เคลื่อนไหว' },
  { key: 'pickup',    icon: '📅', label: 'รอบรับสินค้า' },
  { key: 'varieties', icon: '🌾', label: 'พันธุ์' },
  { key: 'suppliers', icon: '🏪', label: 'Supplier' },
];

export default function AdminSeedsPage() {
  const [tab, setTab] = useState<Tab>('movements');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} เมล็ดพันธุ์ — ${cur.label}`} subtitle="จัดการ Supplier พันธุ์ และการเคลื่อนไหว">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'movements' && <StockMovementPanel />}
      {tab === 'pickup'    && <AdminPickupSlots />}
      {tab === 'varieties' && <AdminSeedVarieties />}
      {tab === 'suppliers' && <AdminSeedSuppliers />}
    </AdminWebShell>
  );
}
