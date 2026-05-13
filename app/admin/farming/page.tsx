'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { FarmingMap } from '@/features/admin-farming/farming-map';
import { HarvestCalendarPanel } from '@/features/admin-farming/harvest-calendar-panel';
import { YieldConfigPanel } from '@/features/admin-farming/yield-config-panel';
import { AdminPlotsList } from '@/features/admin-plots/admin-plots-list';
import { AdminPlantingList } from '@/features/admin-planting/admin-planting-list';
import { AdminNoBurnList } from '@/features/admin-no-burn/admin-no-burn-list';
import { AdminInspectionsList } from '@/features/admin-inspections/admin-inspections-list';

type Tab = 'map' | 'calendar' | 'plots' | 'planting' | 'noburn' | 'inspections' | 'config';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'map',         icon: '🗺️', label: 'แผนที่' },
  { key: 'calendar',    icon: '📅', label: 'ปฏิทิน' },
  { key: 'plots',       icon: '🌾', label: 'แปลง' },
  { key: 'planting',    icon: '🌱', label: 'รอบปลูก' },
  { key: 'noburn',      icon: '🔥', label: 'งดเผา' },
  { key: 'inspections', icon: '🔍', label: 'งานตรวจ' },
  { key: 'config',      icon: '⚙️', label: 'ตั้งค่า' },
];

export default function AdminFarmingPage() {
  const [tab, setTab] = useState<Tab>('map');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} เกษตรกรรม — ${cur.label}`} subtitle="แผนที่ แปลง รอบปลูก งดเผา และงานตรวจ">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12, overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px', flexShrink: 0 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'map'         && <FarmingMap />}
      {tab === 'calendar'    && <HarvestCalendarPanel />}
      {tab === 'plots'       && <AdminPlotsList />}
      {tab === 'planting'    && <AdminPlantingList />}
      {tab === 'noburn'      && <AdminNoBurnList />}
      {tab === 'inspections' && <AdminInspectionsList />}
      {tab === 'config'      && <YieldConfigPanel />}
    </AdminWebShell>
  );
}
