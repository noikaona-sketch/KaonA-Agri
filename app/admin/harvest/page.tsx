'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminHarvestList }   from '@/features/admin-harvest/admin-harvest-list';
import { HarvestDashboard }        from '@/features/admin-harvest/harvest-dashboard';
import { HarvestAccuracyPage }   from '@/features/admin-harvest/harvest-accuracy-page';
import { HarvestRiskIndicator } from '@/features/admin-harvest/harvest-risk-indicator';
import { AdminHarvestQueue } from '@/features/admin-harvest/admin-harvest-queue';
import { AdminProviderRatings } from '@/features/service-rating/admin-provider-ratings';

type Tab = 'dashboard' | 'risk' | 'accuracy' | 'queue' | 'bookings' | 'ratings';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: 'สรุป' },
  { key: 'risk', icon: '⚠️', label: 'ความเสี่ยง' },
  { key: 'accuracy',  icon: '🎯', label: 'ความแม่น' },
  { key: 'queue',    icon: '📋', label: 'คิวเกี่ยว' },
  { key: 'bookings', icon: '🚜', label: 'นัดรถเกี่ยว' },
  { key: 'ratings',  icon: '⭐', label: 'คะแนนผู้ให้บริการ' },
];

export default function HarvestPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} รถเกี่ยว — ${cur.label}`} subtitle="จัดการนัด ติดตาม และประเมินผู้ให้บริการ">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div />
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/harvest/timing" className="admin-btn admin-btn--secondary" style={{ fontSize: 12, padding: '6px 10px' }}>⏱️ Timing Flags</Link>
          <Link href="/admin/harvest/analytics" className="admin-btn admin-btn--secondary" style={{ fontSize: 12, padding: '6px 10px' }}>📈 Analytics</Link>
        </div>
      </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
        <Link href="/admin/harvest/calendar" className="admin-btn admin-btn--secondary" style={{ fontSize: 13, padding: '7px 14px' }}>
          🗓️ ปฏิทินรับเข้า
        </Link>
      </div>
      {tab === 'dashboard' && <HarvestDashboard />}
      {tab === 'risk' && <HarvestRiskIndicator />}
      {tab === 'accuracy'  && <HarvestAccuracyPage />}
      {tab === 'queue'    && <AdminHarvestQueue />}
      {tab === 'bookings' && <AdminHarvestList />}
      {tab === 'ratings'  && <AdminProviderRatings />}
    </AdminWebShell>
  );
}
