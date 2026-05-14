'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';

type TeamMember = {
  id: string; full_name: string; phone: string | null; status: string;
};
type TeamCycle = {
  id: string; crop_name: string; season_year: number; status: string;
  planted_at: string | null; expected_harvest_at: string | null;
  estimated_yield_kg: number | null;
  plots: { name: string }[] | null;
  members: { full_name: string }[] | null;
};

const CYCLE_STATUS: Record<string, { icon: string; color: string }> = {
  planned:   { icon: '📋', color: '#1565c0' },
  planted:   { icon: '🌱', color: '#2e7d32' },
  growing:   { icon: '🌿', color: '#388e3c' },
  flowering: { icon: '🌸', color: '#f57f17' },
  maturing:  { icon: '🌽', color: '#e65100' },
  ready:     { icon: '✅', color: '#c62828' },
  harvested: { icon: '🏁', color: '#9e9e9e' },
};

export default function TeamPage() {
  const member = useCurrentMember();
  const [groupName, setGroupName] = useState<string>('');
  const [members, setMembers]     = useState<TeamMember[]>([]);
  const [cycles, setCycles]       = useState<TeamCycle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'members' | 'cycles'>('members');

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();

      // ดึงกลุ่มที่ตัวเองเป็นสมาชิก
      const { data: myGroups } = await s.from('member_group_members')
        .select('group_id, member_groups(id, name)')
        .eq('member_id', member.member_id)
        .limit(1);

      const group = (myGroups?.[0]?.member_groups as { id: string; name: string }[] | null)?.[0] ?? null;
      if (!group) { setLoading(false); return; }

      setGroupName(group.name);

      // ดึงสมาชิกในกลุ่ม
      const { data: groupMembers } = await s.from('member_group_members')
        .select('members(id, full_name, phone, status)')
        .eq('group_id', group.id);

      const memberList = (groupMembers ?? []).map((gm: { members: TeamMember[] | null }) => gm.members?.[0] ?? null).filter(Boolean) as TeamMember[];
      setMembers(memberList);

      // ดึงรอบปลูกของสมาชิกในกลุ่ม
      const memberIds = memberList.map((m) => m.id);
      if (memberIds.length > 0) {
        const { data: cyclesData } = await s.from('planting_cycles')
          .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,estimated_yield_kg,plots(name),members(full_name)')
          .in('member_id', memberIds)
          .not('status', 'in', '("harvested","cancelled")')
          .order('expected_harvest_at');
        setCycles((cyclesData as TeamCycle[]) ?? []);
      }
      setLoading(false);
    })();
  }, [member?.member_id]);

  function daysLeft(d: string | null) {
    if (!d) return null;
    return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="ทีมของฉัน" subtitle="ภาพรวมกลุ่มและรอบปลูกทั้งหมด">
      <div className="mobile-stack">

        {/* group card */}
        {groupName ? (
          <div className="home-hero">
            <p className="home-hero__greeting">กลุ่ม</p>
            <p className="home-hero__name">{groupName}</p>
            <div className="home-hero__stats">
              <div className="home-hero__stat">
                <p className="home-hero__stat-val">{members.length}</p>
                <p className="home-hero__stat-lbl">สมาชิก</p>
              </div>
              <div className="home-hero__stat">
                <p className="home-hero__stat-val">{cycles.length}</p>
                <p className="home-hero__stat-lbl">รอบปลูก</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="kaona-card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>ยังไม่ได้อยู่ในกลุ่ม</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>ติดต่อ admin เพื่อเข้าร่วมกลุ่ม</p>
          </div>
        )}

        {groupName && (
          <>
            {/* tabs */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['members', 'cycles'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t ? 'var(--primary)' : '#f0f4f0', color: tab === t ? '#fff' : 'var(--text-secondary)' }}>
                  {t === 'members' ? `👥 สมาชิก (${members.length})` : `🌱 รอบปลูก (${cycles.length})`}
                </button>
              ))}
            </div>

            {/* members tab */}
            {tab === 'members' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {members.map((m) => (
                  <div key={m.id} className="kaona-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#2e7d32', flexShrink: 0 }}>
                      {m.full_name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{m.full_name}</p>
                      {m.phone && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{m.phone}</p>}
                    </div>
                    {m.phone && (
                      <a href={`tel:${m.phone}`} style={{ color: 'var(--primary)', fontSize: 20, textDecoration: 'none' }}>📞</a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* cycles tab */}
            {tab === 'cycles' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {cycles.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px 0', fontSize: 14 }}>ยังไม่มีรอบปลูกที่กำลังดำเนินการ</p>
                )}
                {cycles.map((c) => {
                  const st = CYCLE_STATUS[c.status] ?? { icon: '📋', color: '#1565c0' };
                  const days = daysLeft(c.expected_harvest_at);
                  return (
                    <Link key={c.id} href={`/planting-cycles/${c.id}`} style={{ textDecoration: 'none' }}>
                      <div className="kaona-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{st.icon} {c.crop_name} {c.season_year}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                              👤 {c.members?.[0]?.full_name} · {c.plots?.[0]?.name ?? '—'}
                            </p>
                            {c.estimated_yield_kg && (
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                                ~{c.estimated_yield_kg.toLocaleString()} กก.
                              </p>
                            )}
                          </div>
                          {days !== null && (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: (days <= 14 ? '#ffebee' : days <= 30 ? '#fff8e1' : '#e8f5e9'), color: (days <= 14 ? '#c62828' : days <= 30 ? '#e65100' : '#2e7d32'), whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                              {days > 0 ? `${days} วัน` : 'พร้อมเก็บ'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </MobileAppShell>
  );
}
