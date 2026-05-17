'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';

type Job = {
  id: string; status: string; scheduled_date: string | null;
  members: { full_name: string; phone: string | null }[];
  plots: { lat: number; lng: number; village: string | null; rai: number }[];
};

const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', overflow: 'hidden' as const },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'รอยืนยัน',    color: '#B45309', bg: '#FFF8DB' },
  confirmed:  { label: 'ยืนยันแล้ว',  color: '#185FA5', bg: '#E6F1FB' },
  in_progress:{ label: 'กำลังทำงาน',  color: '#7C3AED', bg: '#EDE9FE' },
  completed:  { label: 'เสร็จแล้ว',   color: '#3B6D11', bg: '#EAF3DE' },
  cancelled:  { label: 'ยกเลิก',      color: '#991B1B', bg: '#FEE2E2' },
};

const FILTERS = ['ทั้งหมด','วันนี้','รอยืนยัน','เสร็จแล้ว'] as const;

export default function TruckPage() {
  const member = useCurrentMember();
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<typeof FILTERS[number]>('ทั้งหมด');
  const [today]               = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!member?.member_id) return;
    void fetch(`/api/truck/jobs?truck_owner_id=${member.member_id}`)
      .then((r) => r.json())
      .then((d: { jobs?: Job[] }) => { setJobs(d.jobs ?? []); setLoading(false); });
  }, [member?.member_id]);

  const filtered = jobs.filter((j) => {
    if (filter === 'วันนี้')     return j.scheduled_date?.startsWith(today);
    if (filter === 'รอยืนยัน')  return j.status === 'pending';
    if (filter === 'เสร็จแล้ว') return j.status === 'completed';
    return true;
  });

  const todayCount = jobs.filter((j) => j.scheduled_date?.startsWith(today)).length;
  const doneCount  = jobs.filter((j) => j.status === 'completed').length;

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero */}
        <div style={{ ...S.card, padding: '16px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>งานรถเกี่ยว</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>รายการงานที่ได้รับมอบหมาย</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[
              { label: 'งานทั้งหมด', value: jobs.length },
              { label: 'งานวันนี้',  value: todayCount },
              { label: 'เสร็จแล้ว',  value: doneCount },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 20, border: filter === f ? '1.5px solid #3B6D11' : '0.5px solid var(--color-border-tertiary,#e4ede4)', background: filter === f ? '#EAF3DE' : 'var(--color-background-primary,#fff)', color: filter === f ? '#3B6D11' : 'var(--color-text-secondary,#888)', fontWeight: filter === f ? 500 : 400, fontSize: 13, cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary,#888)' }}>
            <p style={{ fontSize: 40, margin: '0 0 8px' }}>🚜</p>
            <p style={{ fontSize: 14 }}>ไม่มีงาน{filter !== 'ทั้งหมด' ? filter : ''}ในขณะนี้</p>
          </div>
        )}

        {filtered.map((j) => {
          const st = STATUS_CFG[j.status] ?? STATUS_CFG.pending;
          const m  = j.members[0];
          const pl = j.plots[0];
          const mapUrl = pl ? `https://maps.google.com/?q=${pl.lat},${pl.lng}` : null;
          return (
            <div key={j.id} style={{ ...S.card }}>
              <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary,#111)' }}>{m?.full_name ?? '—'}</p>
                  {pl && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>📍 {pl.village ?? ''} · {pl.rai} ไร่</p>}
                  {j.scheduled_date && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary,#888)' }}>📅 {new Date(j.scheduled_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
              </div>
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)', display: 'flex' }}>
                {m?.phone && (
                  <a href={`tel:${m.phone}`}
                    style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, color: '#185FA5', textDecoration: 'none', borderRight: mapUrl ? '0.5px solid var(--color-border-tertiary,#e4ede4)' : 'none' }}>
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
      </div>
    </MobileAppShell>
  );
}
