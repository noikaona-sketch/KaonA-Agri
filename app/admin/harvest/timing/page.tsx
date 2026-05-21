'use client';

import Link                             from 'next/link';
import { useState }                     from 'react';
import { AdminWebShell }                from '@/shared/components/admin-web-shell';
import { HarvestTimingFlags }           from '@/features/admin-harvest/harvest-timing-flags';
import { MoistureCalculatorForm }       from '@/features/harvest-calculator/moisture-calculator-form';

type Tab = 'flags' | 'calculator';
const TABS: { key: Tab; label: string }[] = [
  { key: 'flags',      label: '⏱️ Timing Flags' },
  { key: 'calculator', label: '📊 คำนวณ ชื้น/บาท' },
];

export default function HarvestTimingPage() {
  const [tab, setTab] = useState<Tab>('flags');
  return (
    <AdminWebShell title="⏱️ Harvest Timing" subtitle="Timing flags and moisture vs baht calculator">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Link href="/admin/harvest" className="admin-btn admin-btn--secondary" style={{ fontSize: 13, padding: '7px 14px' }}>
          ← กลับหน้ารถเกี่ยว
        </Link>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize: 13, padding: '7px 14px' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'flags'      && <HarvestTimingFlags />}
      {tab === 'calculator' && <MoistureCalculatorForm compact />}
    </AdminWebShell>
  );
}
