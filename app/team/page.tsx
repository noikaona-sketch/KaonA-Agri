'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';

type TeamMember = {
  id: string; full_name: string; phone: string | null;
  status: string; plot_count: number;
  planting_cycles: { id: string; status: string; field_name: string | null; quota_kg: number }[];
};

const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', overflow: 'hidden' as const },
  label: { fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500, letterSpacing: '.04em', margin: '0 0 8px' },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  approved:         { label: 'อนุมัติแล้ว',  color: '#3B6D11', bg: '#EAF3DE' },
  pending_approval: { label: 'รออนุมัติ',    color: '#B45309', bg: '#FFF8DB' },
  rejected:         { label: 'ไม่ผ่าน',       color: '#991B1B', bg: '#FEE2E2' },
};

export default function TeamPage() {
  const member = useCurrentMember();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'members' | 'cycles'>('members');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    if (!member?.member_id) return;
    void fetch(`/api/team/members?leader_id=${member.member_id}`)
      .then((r) => r.json())
      .then((d: { members?: TeamMember[] }) => { setMembers(d.members ?? []); setLoading(false); });
  }, [member?.member_id]);

  const filtered = members.filter((m) =>
    !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search)
  );

  const allCycles = members.flatMap((m) =>
    (m.planting_cycles ?? []).map((c) => ({ ...c, member_name: m.full_name, member_id: m.id }))
  ).filter((c) => !['harvested','cancelled'].includes(c.status));

  const pendingCount = members.filter((m) => m.status === 'pending_approval').length;

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero */}
        <div style={{ ...S.card, padding: '16px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>หัวหน้าทีม</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>ดูแลลูกทีม · สรุปพื้นที่ · ติดตามสถานะ</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{members.length}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>ลูกทีมทั้งหมด</p>
            </div>
            <div style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: pendingCount > 0 ? '#B45309' : undefined }}>{pendingCount}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>รออนุมัติ</p>
            </div>
            <div style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{allCycles.length}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>รอบปลูกแอคทีฟ</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/field/assist-registration" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ ...S.card, padding: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20 }}>👤</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>ช่วยสมัครสมาชิก</p>
            </div>
          </Link>
          <Link href="/service/reservations" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ ...S.card, padding: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20 }}>🌽</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>จองเมล็ด</p>
            </div>
          </Link>
          <Link href="/field#reservation" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ ...S.card, padding: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20 }}>📋</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>จองให้ลูกทีม</p>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 12, padding: 4 }}>
          {(['members','cycles'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: tab === t ? 500 : 400, fontSize: 13, background: tab === t ? 'var(--color-background-primary,#fff)' : 'transparent', color: tab === t ? 'var(--color-text-primary,#111)' : 'var(--color-text-secondary,#888)', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t === 'members' ? `👥 ลูกทีม (${members.length})` : `🌱 รอบปลูก (${allCycles.length})`}
            </button>
          ))}
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}

        {/* Members tab */}
        {!loading && tab === 'members' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...S.card, padding: '10px 14px' }}>
              <span style={{ fontSize: 16 }}>🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือเบอร์…"
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' }} />
            </div>
            {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary,#888)', fontSize: 14, padding: '16px 0' }}>ไม่พบข้อมูล</p>}
            {filtered.map((m) => {
              const st = STATUS_CFG[m.status] ?? STATUS_CFG.approved;
              return (
                <div key={m.id} style={{ ...S.card }}>
                  <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-background-secondary,#f9fafb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, flexShrink: 0 }}>
                        {m.full_name[0]}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{m.full_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>{m.phone ?? ''} · {m.plot_count} แปลง</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500, flexShrink: 0 }}>{st.label}</span>
                  </div>
                  {m.phone && (
                    <div style={{ borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)', display: 'flex' }}>
                      <a href={`tel:${m.phone}`} style={{ flex: 1, padding: '9px', textAlign: 'center', fontSize: 13, color: '#185FA5', textDecoration: 'none' }}>📞 โทร</a>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Cycles tab */}
        {!loading && tab === 'cycles' && (
          <>
            {allCycles.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary,#888)', fontSize: 14, padding: '16px 0' }}>ไม่มีรอบปลูกที่กำลังดำเนินการ</p>}
            {allCycles.map((c) => (
              <Link key={c.id} href={`/planting-cycles/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ ...S.card, padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{c.field_name ?? 'แปลง'}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>👤 {c.member_name} · โควต้า {c.quota_kg.toLocaleString()} กก.</p>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </MobileAppShell>
  );
}
