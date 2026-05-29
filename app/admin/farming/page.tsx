'use client';

import { useState } from 'react';
import { AdminWebShell }          from '@/shared/components/admin-web-shell';
import { FarmingMap }             from '@/features/admin-farming/farming-map';
import { HarvestCalendarPanel }   from '@/features/admin-farming/harvest-calendar-panel';
import { YieldConfigPanel }       from '@/features/admin-farming/yield-config-panel';
import { AdminNoBurnList }        from '@/features/admin-no-burn/admin-no-burn-list';
import { AdminPlotsList }         from '@/features/admin-plots/admin-plots-list';
import { AdminPlotsMapView }      from '@/features/admin-plots/admin-plots-map-view';

import { AdminPlantingTracker }   from '@/features/admin-farming/admin-planting-tracker';

type Tab = 'map' | 'plots' | 'plots-map' | 'tracker' | 'calendar' | 'config' | 'no-burn';

const TABS: { key:Tab; icon:string; label:string }[] = [
  { key:'map',       icon:'🗺️', label:'แผนที่แปลง'        },
  { key:'plots',     icon:'🌾', label:'แปลง'              },
  { key:'plots-map', icon:'📍', label:'แผนที่แปลงสมาชิก'   },
  { key:'tracker',   icon:'📋', label:'ติดตามรอบปลูก'      },
  { key:'calendar',  icon:'📅', label:'ปฏิทินเก็บเกี่ยว'   },
  { key:'config',    icon:'⚙️', label:'ตั้งค่า Yield / ราคา' },
  { key:'no-burn',   icon:'🌿', label:'งดเผา' },
];

export default function AdminFarmingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const current = TABS.find(t => t.key === activeTab)!;

  return (
    <AdminWebShell title={`${current.icon} ${current.label}`} subtitle="ภาพรวมการเพาะปลูก ปฏิทินเก็บเกี่ยว และตั้งค่าระบบ">
      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid #e8ede8', paddingBottom:12, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`admin-btn ${activeTab===t.key?'admin-btn--primary':'admin-btn--secondary'}`}
            style={{ fontSize:13, padding:'7px 16px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'map'       && <FarmingMap />}
      {activeTab === 'plots'     && <AdminPlotsList />}
      {activeTab === 'plots-map' && <AdminPlotsMapView />}
      {activeTab === 'tracker'   && <AdminPlantingTracker />}
      {activeTab === 'calendar'  && <HarvestCalendarPanel />}
      {activeTab === 'config'    && <YieldConfigPanel />}
      {activeTab === 'no-burn'   && <AdminNoBurnList />}
    </AdminWebShell>
  );
}
