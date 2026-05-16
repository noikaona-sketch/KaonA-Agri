'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { FieldTeamMap } from '@/features/field-team-map/field-team-map';
import { FieldSeedReservation } from '@/features/field-seed-reservation/field-seed-reservation';

type InspectionTask = {
  id: string; result_status: string;
  assigned_at: string; visited_at: string | null;
  plots: { name: string; province: string | null }[] | null;
  members: { full_name: string; phone: string | null }[] | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  pending:   { icon: '⏳', label: 'รอตรวจ',          color: '#e65100', bg: '#fff8e1' },
  assigned:  { icon: '📋', label: 'ได้รับมอบหมาย',   color: '#1565c0', bg: '#e3f2fd' },
  pass:      { icon: '✅', label: 'ผ่าน',             color: '#2e7d32', bg: '#e8f5e9' },
  fail:      { icon: '❌', label: 'ไม่ผ่าน',          color: '#c62828', bg: '#ffebee' },
};

export default function FieldPage() {
  const member = useCurrentMember();
  const [tasks, setTasks]     = useState<InspectionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tasks' | 'map' | 'reservation'>('tasks');
  const [today]               = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('inspections')
        .select('id,result_status,assigned_at,visited_at,plots(name,province),members(full_name,phone)')
        .eq('inspector_member_id', member.member_id)
        .order('assigned_at', { ascending: false })
        .limit(30);
      setTasks((data as InspectionTask[]) ?? []);
      setLoading(false);
    })();
  }, [member?.member_id]);

  const todayTasks   = tasks.filter((t) => t.assigned_at?.startsWith(today));
  const pendingTasks = tasks.filter((t) => ['pending','assigned'].includes(t.result_status));

  return (
    <MobileAppShell title="ทีมภาคสนาม" subtitle="งานตรวจแปลงและแผนที่สมาชิก">
      <div className="mobile-stack">
        {/* hero */}
        <div className="home-hero">
          <p className="home-hero__greeting">สวัสดี 👋</p>
          <p className="home-hero__name">{member?.full_name ?? 'เจ้าหน้าที่'}</p>
          <span className="home-hero__role">🔍 ผู้ตรวจภาคสนาม</span>
          <div className="home-hero__stats">
            <div className="home-hero__stat">
              <p className="home-hero__stat-val">{todayTasks.length}</p>
              <p className="home-hero__stat-lbl">งานวันนี้</p>
            </div>
            <div className="home-hero__stat">
              <p className="home-hero__stat-val">{pendingTasks.length}</p>
              <p className="home-hero__stat-lbl">รอดำเนินการ</p>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('tasks')} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'tasks' ? 'var(--primary)' : '#f0f4f0', color: tab === 'tasks' ? '#fff' : 'var(--text-secondary)' }}>
            📋 งานตรวจ ({tasks.length})
          </button>
          <button onClick={() => setTab('reservation')} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'reservation' ? 'var(--primary)' : '#f0f4f0', color: tab === 'reservation' ? '#fff' : 'var(--text-secondary)' }}>
            🌾 จองเมล็ด
          </button>
          <button onClick={() => setTab('map')} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'map' ? 'var(--primary)' : '#f0f4f0', color: tab === 'map' ? '#fff' : 'var(--text-secondary)' }}>
            🗺️ แผนที่
          </button>
        </div>

        {/* tasks tab */}
        {tab === 'tasks' && (
          <>
            {loading && <LoadingState label="กำลังโหลดงาน…" />}
            {!loading && tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0' }}>ยังไม่มีงานที่ได้รับมอบหมาย</p>
              </div>
            )}
            {tasks.map((t) => {
              const st = STATUS_CFG[t.result_status] ?? STATUS_CFG.pending;
              const isToday = t.assigned_at?.startsWith(today);
              return (
                <Link key={t.id} href={`/inspection/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
                  <div className="kaona-card" style={{ borderColor: st.color + '66', background: isToday ? st.bg : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>
                          {t.plots?.[0]?.name ?? 'แปลงไม่ระบุ'}
                          {t.plots?.[0]?.province ? ` (${t.plots[0].province})` : ''}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                          👤 {t.members?.[0]?.full_name ?? '—'} {t.members?.[0]?.phone ? `· ${t.members[0].phone}` : ''}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {isToday ? '📅 วันนี้' : new Date(t.assigned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </>
        )}

        {/* map tab */}
        {tab === 'map' && <FieldTeamMap />}

        {/* reservation tab */}
        {tab === 'reservation' && <FieldSeedReservation />}
      </div>
    </MobileAppShell>
  );
}
