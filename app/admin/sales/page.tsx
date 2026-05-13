'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminPos } from '@/features/admin-pos/admin-pos';
import { AdminOrdersList } from '@/features/admin-orders/admin-orders-list';
import { AdminProductsList } from '@/features/admin-products/admin-products-list';
import { AdminStockList } from '@/features/admin-stock/admin-stock-list';
import { AdminAppointmentsList } from '@/features/admin-appointments/appointments-list';

type Tab = 'pos' | 'orders' | 'appointments' | 'products' | 'stock';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'pos',          icon: '💰', label: 'POS ขาย' },
  { key: 'orders',       icon: '📋', label: 'คำสั่งซื้อ' },
  { key: 'appointments', icon: '📅', label: 'นัดขาย' },
  { key: 'products',     icon: '🛍️', label: 'สินค้า' },
  { key: 'stock',        icon: '📦', label: 'สต๊อก' },
];

export default function AdminSalesPage() {
  const [tab, setTab] = useState<Tab>('pos');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} ขาย/สต๊อก — ${cur.label}`} subtitle="POS ขาย คำสั่งซื้อ นัดขาย สินค้า และสต๊อก">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'pos'          && <AdminPos />}
      {tab === 'orders'       && <AdminOrdersList />}
      {tab === 'appointments' && <AdminAppointmentsList />}
      {tab === 'products'     && <AdminProductsList />}
      {tab === 'stock'        && <AdminStockList />}
    </AdminWebShell>
  );
}
