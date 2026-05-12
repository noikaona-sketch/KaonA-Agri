'use client';

import { useState } from 'react';

import { FarmingMap } from '@/features/admin-farming/farming-map';
import { HarvestCalendarPanel } from '@/features/admin-farming/harvest-calendar-panel';
import { YieldConfigPanel } from '@/features/admin-farming/yield-config-panel';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

type Tab = 'map' | 'calendar' | 'config';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'map',      icon: '🗺️', label: 'แผนที่แปลง' },
  { key: 'calendar', icon: '📅', label: 'ปฏิทินเก็บเกี่ยว' },
  { key: 'config',   icon: '⚙️', label: 'ตั้งค่า Yield / ราคา' },
];

export default function AdminFarmingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const current = TABS.find((t) => t.key === activeTab)!;

  return (
    <AdminWebShell title={`${current.icon} ${current.label}`} subtitle="ภาพรวมการเพาะปลูก ปฏิทินเก็บเกี่ยว และตั้งค่าระบบ">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`admin-btn ${activeTab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 14, padding: '8px 16px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'map'      && <FarmingMap />}
      {activeTab === 'calendar' && <HarvestCalendarPanel />}
      {activeTab === 'config'   && <YieldConfigPanel />}
    </AdminWebShell>
  );
}
