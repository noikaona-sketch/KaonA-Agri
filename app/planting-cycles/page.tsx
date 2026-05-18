'use client';

import { useState } from 'react';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }          from '@/shared/components/protected-route';
import { CompletenessReminder }     from '@/shared/components/completeness-reminder';
import { PlantingCycleList } from '@/features/member-planting/planting-cycle-list';
import { SaleHistory } from '@/features/member-planting/sale-history';

type Tab = 'cycles' | 'sales';

export default function PlantingCyclesPage() {
  const [tab, setTab] = useState<Tab>('cycles');
  return (
    <ProtectedRoute>
      <MobileAppShell title="รอบเพาะปลูก" subtitle="ติดตามการเพาะปลูกและประวัติขาย">
        <CompletenessReminder />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([
            { key: 'cycles', label: '🌱 รอบปลูก' },
            { key: 'sales',  label: '💰 ประวัติขาย' },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t.key ? 'var(--primary)' : '#f0f4f0', color: tab === t.key ? '#fff' : 'var(--text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'cycles' && <PlantingCycleList />}
        {tab === 'sales'  && <SaleHistory />}
      </MobileAppShell>
    </ProtectedRoute>
  );
}
