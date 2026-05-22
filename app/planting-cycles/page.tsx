'use client';

import { useState }                from 'react';
import { MobileAppShell }          from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }          from '@/shared/components/protected-route';
import { CompletenessReminder }    from '@/shared/components/completeness-reminder';
import { PlantingCycleList }       from '@/features/member-planting/planting-cycle-list';
import { SaleHistory }             from '@/features/member-planting/sale-history';
import { MemberSeasonReport }      from '@/features/member-report/member-season-report';
import { useCurrentMember }        from '@/providers/auth-provider';

type Tab = 'cycles' | 'sales' | 'report';

function PlantingCyclesContent() {
  const [tab, setTab] = useState<Tab>('cycles');
  const member = useCurrentMember();
  return (
    <MobileAppShell title="รอบเพาะปลูก" subtitle="ติดตามการเพาะปลูกและประวัติขาย">
      <CompletenessReminder />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          { key: 'cycles', label: '🌱 รอบปลูก'   },
          { key: 'sales',  label: '💰 ประวัติขาย' },
          { key: 'report', label: '📊 รายงาน'     },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer',
              fontWeight:700, fontSize:12,
              background: tab === t.key ? 'var(--primary)' : '#f0f4f0',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cycles' && <PlantingCycleList />}
      {tab === 'sales'  && <SaleHistory />}
      {tab === 'report' && member?.member_id
        ? <MemberSeasonReport memberId={member.member_id} />
        : tab === 'report' && <p style={{ color:'var(--color-text-secondary)', fontSize:13, textAlign:'center', padding:24 }}>กำลังโหลด…</p>
      }
    </MobileAppShell>
  );
}

export default function PlantingCyclesPage() {
  return (
    <ProtectedRoute>
      <PlantingCyclesContent />
    </ProtectedRoute>
  );
}
