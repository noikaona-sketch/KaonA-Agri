'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { ProtectedRoute } from '@/shared/components/protected-route';

type Task = {
  id: string; result_status: string; result_note: string | null;
  assigned_at: string; visited_at: string | null;
  plots: { name: string; province: string | null; lat: number | null; lng: number | null }[] | null;
  members: { full_name: string; phone: string | null }[] | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string }> = {
  pending:  { icon: '⏳', label: 'รอตรวจ',     color: '#e65100' },
  assigned: { icon: '📋', label: 'รับมอบหมาย', color: '#1565c0' },
  pass:     { icon: '✅', label: 'ผ่าน',        color: '#2e7d32' },
  fail:     { icon: '❌', label: 'ไม่ผ่าน',     color: '#c62828' },
};

function TaskList() {
  const member = useCurrentMember();
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'active' | 'all'>('active');

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      let q = s.from('inspections')
        .select('id,result_status,result_note,assigned_at,visited_at,plots(name,province,lat,lng),members(full_name,phone)')
        .eq('inspector_member_id', member.member_id)
        .order('assigned_at', { ascending: false }).limit(50);
      if (filter === 'active') q = q.in('result_status', ['pending','assigned']);
      const { data } = await q;
      setTasks((data as Task[]) ?? []);
      setLoading(false);
    })();
  }, [member?.member_id, filter]);

  return (
    <MobileAppShell title="งานตรวจแปลง" subtitle="รายการตรวจที่ได้รับมอบหมาย">
      <div className="mobile-stack">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['active', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: filter === f ? 'var(--primary)' : '#f0f4f0', color: filter === f ? '#fff' : 'var(--text-secondary)' }}>
              {f === 'active' ? 'รอดำเนินการ' : 'ทั้งหมด'}
            </button>
          ))}
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}
        {!loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0' }}>ไม่มีงานตรวจ</p>
          </div>
        )}

        {tasks.map((t) => {
          const st = STATUS_CFG[t.result_status] ?? STATUS_CFG.pending;
          return (
            <Link key={t.id} href={`/inspection/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
              <div className="kaona-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>
                      {t.plots?.[0]?.name ?? '—'} {t.plots?.[0]?.province ? `(${t.plots[0].province})` : ''}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                      👤 {t.members?.[0]?.full_name ?? '—'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      📅 {new Date(t.assigned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {t.plots?.[0]?.lat && t.plots?.[0]?.lng && (
                      <a href={`https://maps.google.com/?q=${t.plots[0].lat},${t.plots[0].lng}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 4, display: 'block' }}
                        onClick={(e) => e.stopPropagation()}>
                        📍 เปิดใน Google Maps
                      </a>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>
                    {st.icon} {st.label}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </MobileAppShell>
  );
}

export default function InspectionTasksPage() {
  return <ProtectedRoute><TaskList /></ProtectedRoute>;
}
