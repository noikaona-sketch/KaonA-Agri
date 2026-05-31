'use client';

import { useState }             from 'react';
import { useRouter }            from 'next/navigation';
import { MobileAppShell }       from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }       from '@/shared/components/protected-route';
import { MoistureCalculatorForm } from '@/features/harvest-calculator/moisture-calculator-form';
import { SmartHarvestPanel }    from '@/features/harvest-calculator/smart-harvest-panel';
import { useCurrentMember }     from '@/providers/auth-provider';

type Tab = 'smart' | 'manual';

function CalculatorContent() {
  const router = useRouter();
  const member = useCurrentMember();
  const [tab, setTab] = useState<Tab>('smart');

  return (
    <MobileAppShell title="🌽 คำนวณรายได้" subtitle="เปรียบเทียบราคาตามอายุข้าวโพด">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button className="admin-btn admin-btn--secondary" onClick={() => router.back()}
          style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }}>← กลับ</button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { key: 'smart',  label: '🎯 อัจฉริยะ',    desc: 'ตามอายุ+นัดหมาย' },
            { key: 'manual', label: '🔢 กรอกเอง',      desc: 'ใส่ความชื้นเอง' },
          ] as { key: Tab; label: string; desc: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#1b5e20' : '#f0f4f0',
                color:      tab === t.key ? '#fff'    : '#374151',
                fontWeight: 700, fontSize: 13,
              }}>
              <div>{t.label}</div>
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {tab === 'smart'  && <SmartHarvestPanel />}
        {tab === 'manual' && <MoistureCalculatorForm memberId={member?.member_id} />}
      </div>
    </MobileAppShell>
  );
}

export default function HarvestCalculatorPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'staff', 'leader', 'admin']}>
      <CalculatorContent />
    </ProtectedRoute>
  );
}
