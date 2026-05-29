'use client';

import { useState }             from 'react';
import { MobileAppShell }       from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }       from '@/shared/components/protected-route';
import { CompletenessReminder } from '@/shared/components/completeness-reminder';
import { PlantingCycleList }    from '@/features/member-planting/planting-cycle-list';
import { SaleHistory }          from '@/features/member-planting/sale-history';
import { MemberSeasonReport }   from '@/features/member-report/member-season-report';
import { NotificationsList }    from '@/features/member-planting/notifications-list';
import { useCurrentMember }     from '@/providers/auth-provider';

type Tab = 'cycles' | 'sales' | 'report' | 'notif';

function PlantingCyclesContent() {
  const [tab, setTab] = useState<Tab>('cycles');
  const member = useCurrentMember();

  const TABS = [
    { key: 'cycles', label: '🌱 รอบปลูก'   },
    { key: 'sales',  label: '💰 ประวัติขาย' },
    { key: 'report', label: '📊 รายงาน'     },
    { key: 'notif',  label: '🔔 แจ้งเตือน'  },
  ] as const;

  return (
    <MobileAppShell title="🌾 ไร่ของฉัน" subtitle="รอบปลูก · ประวัติขาย · แจ้งเตือน">
      <CompletenessReminder />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flexShrink: 0, padding: '9px 14px', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
              background: tab === t.key ? 'var(--primary)' : '#f0f4f0',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cycles' && <PlantingCycleList />}
      {tab === 'sales'  && <SaleHistory />}
      {tab === 'notif'  && <NotificationsList />}
      {tab === 'report' && member?.member_id
        ? <MemberSeasonReport memberId={member.member_id} />
        : tab === 'report' && <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 24 }}>กำลังโหลด…</p>
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
