'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { FieldTeamMap } from '@/features/field-team-map/field-team-map';
import { FieldMemberMap }        from '@/features/field/field-member-map';
import { QuickVisitForm }        from '@/features/field/quick-visit-form';
import { NearMeList }            from '@/features/field/near-me-list';
import { FieldSeedReservation } from '@/features/field-seed-reservation/field-seed-reservation';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type InspectionTask = {
  id: string; status: string; result_status: string;
  assigned_at: string | null; completed_at: string | null;
  members: { full_name: string; phone: string | null }[];
  plots: { lat: number | null; lng: number | null; name: string | null; area_rai: number | null }[];
};

const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', overflow: 'hidden' as const },
  label: { fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500, letterSpacing: '.04em', margin: 0 },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'รอดำเนินการ', color: '#B45309', bg: '#FFF8DB' },
  assigned:   { label: 'รับงานแล้ว',  color: '#185FA5', bg: '#E6F1FB' },
  in_progress:{ label: 'กำลังตรวจ',   color: '#7C3AED', bg: '#EDE9FE' },
  completed:  { label: 'เสร็จแล้ว',   color: '#3B6D11', bg: '#EAF3DE' },
  cancelled:  { label: 'ยกเลิก',      color: '#991B1B', bg: '#FEE2E2' },
};

export default function FieldPage() {
  const member = useCurrentMember();
  const [tasks,   setTasks]   = useState<InspectionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [today]               = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'tasks' | 'reservation' | 'map' | 'register' | 'visit' | 'nearby'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#reservation') return 'reservation';
    return 'tasks';
  });

  useEffect(() => {
    if (!member?.member_id) return;
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    void sb.from('inspections')
      .select('id,result_status,assigned_at,members:member_id(full_name,phone),plots(lat,lng,name,area_rai)')
      .eq('inspector_member_id', member.member_id)
      .order('assigned_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setTasks((data as unknown as InspectionTask[]) ?? []); setLoading(false); });
  }, [member?.member_id]);

  const todayTasks   = tasks.filter((t) => t.assigned_at?.startsWith(today));
  const pendingTasks = tasks.filter((t) => ['pending','assigned'].includes(t.result_status));

  const TABS = [
    { key: 'tasks',       label: `📋 งานตรวจ (${tasks.length})` },
    { key: 'reservation', label: '🌽 จองเมล็ด' },
    { key: 'register',    label: '➕ สมัครสมาชิก' },
    { key: 'map',         label: '🗺️ แผนที่' },
    { key: 'visit',       label: '🤝 บันทึกเยี่ยม' },
    { key: 'nearby',      label: '📡 ใกล้ฉัน' },
  ] as const;

  return (
    <ProtectedRoute allowedRoles={['staff','inspector','leader','admin']}>
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero */}
        <div style={{ ...S.card, padding: '16px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>ทีมภาคสนาม</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>สมัครสมาชิก · จองเมล็ด · งานตรวจ · แผนที่</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{todayTasks.length}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>งานวันนี้</p>
            </div>
            <div style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{pendingTasks.length}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>รอดำเนินการ</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 12, padding: 4 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 500 : 400, fontSize: 12, background: tab === t.key ? 'var(--color-background-primary,#fff)' : 'transparent', color: tab === t.key ? 'var(--color-text-primary,#111)' : 'var(--color-text-secondary,#888)', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <>
            {loading && <LoadingState label="กำลังโหลด…" />}
            {!loading && tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary,#888)' }}>
                <p style={{ fontSize: 40, margin: '0 0 8px' }}>📋</p>
                <p style={{ fontSize: 14 }}>ยังไม่มีงานที่ได้รับมอบหมาย</p>
              </div>
            )}
            {tasks.map((t) => {
              const st  = STATUS_CFG[t.result_status] ?? STATUS_CFG.pending;
              const m   = t.members[0];
              const pl  = t.plots[0];
              const mapUrl = pl ? `https://maps.google.com/?q=${pl.lat},${pl.lng}` : null;
              return (
                <div key={t.id} style={{ ...S.card }}>
                  <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{m?.full_name ?? '—'}</p>
                      {pl && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>📍 {pl.name ?? ''} · {pl.area_rai ?? 0} ไร่</p>}
                      {t.assigned_at && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>📅 {new Date(t.assigned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                  </div>
                  <div style={{ borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)', display: 'flex' }}>
                    <Link href={`/inspection/tasks/${t.id}`}
                      style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary,#111)', textDecoration: 'none', borderRight: '0.5px solid var(--color-border-tertiary,#e4ede4)' }}>
                      บันทึกผล
                    </Link>
                    {m?.phone && (
                      <a href={`tel:${m.phone}`}
                        style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, color: '#185FA5', textDecoration: 'none', borderRight: '0.5px solid var(--color-border-tertiary,#e4ede4)' }}>
                        📞 โทร
                      </a>
                    )}
                    {mapUrl && (
                      <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, color: '#185FA5', textDecoration: 'none' }}>
                        🗺️ แผนที่
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'reservation' && <FieldSeedReservation />}
        {tab === 'map'         && <FieldTeamMap />}
        {tab === 'visit'       && <QuickVisitForm />}
        {tab === 'nearby'      && <NearMeList />}
        {tab === 'register'    && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...S.card, padding: '14px 16px' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>➕ ลงทะเบียนแทนสมาชิก</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)', lineHeight: 1.6 }}>
                สร้างบัญชีและ PIN 6 หลักให้สมาชิกในพื้นที่<br />
                รองรับเพิ่มแปลง + GPS ณ จุดนั้นเลย
              </p>
              <Link href="/field/assist-registration"
                style={{ display: 'block', marginTop: 10, padding: '11px 16px', background: 'var(--primary,#2e7d32)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
                เริ่มลงทะเบียน →
              </Link>
            </div>
          </div>
        )}
      </div>
    </MobileAppShell>
    </ProtectedRoute>
  );
}


