'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminWebShell }            from '@/shared/components/admin-web-shell';
import { AdminApprovalQueue }       from '@/features/admin-members/admin-approval-queue';
import { AdminMemberList }          from '@/features/admin-members/admin-member-list';
import { AdminGroups }              from '@/features/admin-groups/admin-groups';
import { AdminImportReview }        from '@/features/admin-members/admin-import-review';
import { MemberStatsCards }         from '@/features/admin-members/member-stats-cards';
import { MemberSummaryCollapsible } from '@/features/admin-members/member-summary-collapsible';
import { CreateMemberDrawer }       from '@/features/admin-members/create-member-drawer';
import { CreatePinPanel }           from '@/features/admin-invites/create-pin-panel';

type Tab = 'queue' | 'members' | 'groups' | 'import';

const TABS: { key:Tab; icon:string; label:string }[] = [
  { key:'queue',   icon:'✅', label:'คิวอนุมัติ'  },
  { key:'members', icon:'👥', label:'สมาชิก'      },
  { key:'groups',  icon:'🏘️', label:'กลุ่ม'       },
  { key:'import',  icon:'📥', label:'นำเข้าข้อมูล' },
];

export default function AdminMembersPage() {
  const [tab,         setTab]         = useState<Tab>('queue');
  const [showCreate,  setShowCreate]  = useState(false);
  const [showPin,     setShowPin]     = useState(false);
  const [memberKey,   setMemberKey]   = useState(0);
  const [roleFilter,  setRoleFilter]  = useState<string|null>(null);
  const [groupFilter, setGroupFilter] = useState<string|null>(null);
  const [summaryData, setSummaryData] = useState<{
    by_role: Record<string,{ count:number; approved:number; hasBooking:number; hasCycle:number; hasNoburn:number }>;
    groupSummary: { id:string; name:string; memberCount:number; leader: { id:string; full_name:string } | null; hasBooking:number; hasCycle:number; hasNoburn:number }[];
  } | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/members/stats', { credentials:'include' });
      if (!res.ok) return;
      const d = await res.json() as {
        by_role?: Record<string,{ count:number; approved:number; hasBooking:number; hasCycle:number; hasNoburn:number }>;
        groupSummary?: { id:string; name:string; memberCount:number; leader: { id:string; full_name:string } | null; hasBooking:number; hasCycle:number; hasNoburn:number }[];
      };
      setSummaryData({
        by_role:      d.by_role      ?? {},
        groupSummary: d.groupSummary ?? [],
      });
    } catch(e) { console.error('[summaryData]', e); }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const cur = TABS.find(t => t.key === tab)!;

  return (
    <AdminWebShell title={`${cur.icon} ${cur.label}`} subtitle="จัดการสมาชิก สิทธิ์ กลุ่ม และ PIN">

      {/* Tab bar + action buttons */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:2, background:'#F3F4F6', padding:4, borderRadius:10 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'7px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .12s',
                background: tab===t.key ? '#fff' : 'transparent',
                color:      tab===t.key ? '#111' : '#6B7280',
                boxShadow:  tab===t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'queue' && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowPin(!showPin)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'1.5px solid #D1D5DB', background:'#fff', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
              🔑 สร้าง PIN
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:'#16A34A', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
              ＋ สร้างสมาชิก
            </button>
          </div>
        )}
      </div>

      {/* PIN Panel (collapsible) */}
      {tab === 'queue' && showPin && (
        <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>🔑 สร้าง PIN สำหรับสมาชิก</h3>
            <button onClick={() => setShowPin(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9CA3AF' }}>✕</button>
          </div>
          <CreatePinPanel />
        </div>
      )}

      {/* Tab: คิวอนุมัติ */}
      {tab === 'queue' && <AdminApprovalQueue />}

      {/* Tab: สมาชิก */}
      {tab === 'members' && (
        <>
          <MemberStatsCards onRoleFilter={setRoleFilter} />
          {summaryData && (
            <MemberSummaryCollapsible
              byRole={summaryData.by_role}
              groupSummary={summaryData.groupSummary}
              onRoleClick={r => { setRoleFilter(r); setGroupFilter(null); }}
              onGroupClick={g => { setGroupFilter(g); setRoleFilter(null); }}
            />
          )}
          <AdminMemberList key={memberKey} roleFilter={roleFilter} />
        </>
      )}

      {/* Tab: กลุ่ม */}
      {tab === 'groups' && <AdminGroups />}

      {/* Tab: นำเข้า */}
      {tab === 'import' && <AdminImportReview />}

      {/* Drawer สร้างสมาชิก */}
      <CreateMemberDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setMemberKey(k => k+1); setTab('members'); }}
      />
    </AdminWebShell>
  );
}
