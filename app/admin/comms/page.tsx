'use client';

import { useState }                    from 'react';
import { AdminWebShell }               from '@/shared/components/admin-web-shell';
import { AdminCampaignsManager }       from '@/features/admin-campaigns/admin-campaigns-manager';
import { AdminSurveys }                from '@/features/admin-surveys/admin-surveys';
import { AdminAlertReadinessList }     from '@/features/admin-alerts/admin-alert-readiness-list';

type Tab = 'campaigns' | 'surveys' | 'alerts';

const TABS: { key: Tab; icon: string; label: string; desc: string }[] = [
  { key: 'campaigns', icon: '📢', label: 'ประกาศ & Broadcast', desc: 'ส่งข้อความ LINE + campaigns' },
  { key: 'surveys',   icon: '📝', label: 'แบบสำรวจ',            desc: 'สร้างและดูผล surveys'       },
  { key: 'alerts',    icon: '🚨', label: 'แจ้งเตือน',            desc: 'Weather & readiness alerts' },
];

export default function AdminCommsPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const cur = TABS.find(t => t.key === tab)!;
  return (
    <AdminWebShell
      title="📡 ศูนย์สื่อสาร"
      subtitle="ประกาศ · แบบสำรวจ · แจ้งเตือน — จัดการทุกช่องทางในที่เดียว">

      {/* Tab bar */}
      <div style={{ display:'flex', gap:8, marginBottom:24, borderBottom:'1.5px solid var(--color-border-tertiary)', paddingBottom:12 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', transition:'all .12s',
              background: tab===t.key ? 'var(--color-primary,#2D6A4F)' : 'var(--color-background-secondary)',
              color: tab===t.key ? '#fff' : 'var(--color-text-secondary)' }}>
            <span style={{ fontSize:14 }}>{t.icon} {t.label}</span>
            <span style={{ fontSize:11, opacity:0.7, marginTop:1 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {tab === 'campaigns' && <AdminCampaignsManager />}
      {tab === 'surveys'   && <AdminSurveys />}
      {tab === 'alerts'    && <AdminAlertReadinessList />}
    </AdminWebShell>
  );
}
