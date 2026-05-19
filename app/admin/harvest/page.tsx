'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminHarvestList }  from '@/features/admin-harvest/admin-harvest-list';
import { AdminHarvestQueue } from '@/features/admin-harvest/admin-harvest-queue';
import { AdminProviderRatings } from '@/features/service-rating/admin-provider-ratings';

type Tab = 'queue' | 'bookings' | 'ratings';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'queue',    icon: '📋', label: 'คิวเกี่ยว' },
  { key: 'bookings', icon: '🚜', label: 'นัดรถเกี่ยว' },
  { key: 'ratings',  icon: '⭐', label: 'คะแนนผู้ให้บริการ' },
];

export default function HarvestPage() {
  const [tab, setTab] = useState<Tab>('queue');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} รถเกี่ยว — ${cur.label}`} subtitle="จัดการนัด ติดตาม และประเมินผู้ให้บริการ">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'queue'    && <AdminHarvestQueue />}
      {tab === 'bookings' && <AdminHarvestList />}
      {tab === 'ratings'  && <AdminProviderRatings />}
    </AdminWebShell>
  );
}
