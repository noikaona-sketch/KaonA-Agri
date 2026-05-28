'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }            from '@/providers/auth-provider';
import { MobileAppShell }              from '@/shared/components/mobile-app-shell';
import { LoadingState }                from '@/shared/components/loading-state';
import { ErrorState }                  from '@/shared/components/error-state';
import { UIButton }                    from '@/shared/components/ui-button';
import { NoBurnObservationForm }       from '@/features/no-burn-community/no-burn-observation-form';
import { InspectorResultForm }         from '@/features/inspection-tasks/inspector-result-form';

type Task = {
  id: string; result_status: string; result_note: string | null;
  assigned_at: string; visited_at: string | null;
  gps_lat: number | null; gps_lng: number | null;
  plots:           { id: string; name: string; province: string | null; area_rai: number | null; lat: number | null; lng: number | null }[] | null;
  members:         { full_name: string; phone: string | null }[] | null;
  no_burn_requests:{ id: string; status: string; timing: 'before_planting' | 'after_planting' | null; note: string | null }[] | null;
};

const RESULT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  passed:       { label: '✅ ผ่านการตรวจ',           color: '#1b5e20', bg: '#e8f5e9' },
  failed:       { label: '❌ ไม่ผ่านการตรวจ',        color: '#c62828', bg: '#ffebee' },
  needs_update: { label: '📋 ต้องแก้ไขเพิ่มเติม',   color: '#e65100', bg: '#fff8e1' },
  completed:    { label: '✓ ปิดงานแล้ว',              color: '#2e7d32', bg: '#e8f5e9' },
};

const TIMING_LABEL: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',     color: '#1565c0', bg: '#e3f2fd' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
};

type Props = { params: { id: string } };

export default function InspectionTaskDetailPage({ params }: Props) {
  const member  = useCurrentMember();
  const router  = useRouter();
  const [task,    setTask]    = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: e } = await s.from('inspections')
        .select('id,result_status,result_note,assigned_at,visited_at,gps_lat,gps_lng,plots(id,name,province,area_rai,lat,lng),members(full_name,phone),no_burn_requests(id,status,timing,note)')
        .eq('id', params.id).maybeSingle();
      if (e) setError(e.message);
      else   setTask(data as Task);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !task) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const isDone   = ['passed', 'failed', 'needs_update', 'completed'].includes(task.result_status);
  const resultCfg = RESULT_CFG[task.result_status];
  const noBurnReq = task.no_burn_requests?.[0] ?? null;
  const timingCfg = noBurnReq?.timing ? TIMING_LABEL[noBurnReq.timing] : null;
  const plot      = task.plots?.[0] ?? null;
  const farmer    = task.members?.[0] ?? null;

  return (
    <MobileAppShell title="บันทึกผลตรวจ" subtitle="ตรวจสอบและบันทึกผลการตรวจแปลง">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        <Link href="/inspection/tasks"
          style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← กลับรายการ
        </Link>

        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}

        {/* ── Plot info card ── */}
        <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{plot?.name ?? '—'}</p>
          {plot?.province && <p style={{ margin: '2px 0 0', fontSize: 14, opacity: 0.85 }}>{plot.province}</p>}
          {plot?.area_rai  && <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.8 }}>พื้นที่ {plot.area_rai} ไร่</p>}
          <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.85 }}>
            👤 {farmer?.full_name ?? '—'}{farmer?.phone ? ` · ${farmer.phone}` : ''}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.75 }}>
            📅 มอบหมาย {new Date(task.assigned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* ── No-burn request context ── */}
        {noBurnReq && (
          <div className="kaona-card" style={{ background: '#fafffe', border: '1px solid #bbf7d0' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              🔥 คำของดเผา
            </p>
            {timingCfg && (
              <span style={{
                display: 'inline-block', fontSize: 12, fontWeight: 700,
                padding: '3px 12px', borderRadius: 999, marginBottom: 6,
                background: timingCfg.bg, color: timingCfg.color,
              }}>
                {timingCfg.icon} {timingCfg.label}
              </span>
            )}
            {noBurnReq.note && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>📝 หมายเหตุสมาชิก: {noBurnReq.note}</p>
            )}
          </div>
        )}

        {/* ── GPS link ── */}
        {plot?.lat && plot?.lng && (
          <a href={`https://maps.google.com/?q=${plot.lat},${plot.lng}`}
            target="_blank" rel="noopener noreferrer" className="kaona-card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text-primary)' }}>
            <span style={{ fontSize: 24 }}>📍</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>เปิดใน Google Maps</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}
              </p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text-secondary)' }}>›</span>
          </a>
        )}

        {/* ── Inspector GPS result (if recorded) ── */}
        {task.gps_lat && task.gps_lng && isDone && (
          <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#2e7d32' }}>
            📍 GPS ที่บันทึกไว้: {task.gps_lat.toFixed(5)}, {task.gps_lng.toFixed(5)}
          </div>
        )}

        {/* ── Result display (if done) ── */}
        {isDone && resultCfg && (
          <div className="kaona-card" style={{ background: resultCfg.bg }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: resultCfg.color }}>
              {resultCfg.label}
            </p>
            {task.result_note && (
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{task.result_note}</p>
            )}
            {task.visited_at && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                ตรวจเมื่อ {new Date(task.visited_at).toLocaleDateString('th-TH', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}

        {/* ── Result form (if not done) ── */}
        {!isDone && (
          <>
            {!showForm ? (
              <UIButton fullWidth onClick={() => setShowForm(true)}>
                📝 บันทึกผลการตรวจ
              </UIButton>
            ) : (
              <div className="kaona-card">
                <InspectorResultForm
                  inspectionId={task.id}
                  plotName={plot?.name}
                  farmerName={farmer?.full_name}
                  noBurnTiming={noBurnReq?.timing}
                  noBurnRequestId={noBurnReq?.id}
                  memberId={member?.member_id}
                  plotId={plot?.id}
                  onSuccess={() => {
                    setShowForm(false);
                    setNotice('✅ บันทึกผลการตรวจแล้ว รอแอดมินอนุมัติขั้นสุดท้าย');
                    setTask((p) => p ? { ...p, result_status: 'passed' } : p);
                    setTimeout(() => router.refresh(), 1000);
                  }}
                />
                <button className="admin-btn admin-btn--ghost"
                  onClick={() => setShowForm(false)}
                  style={{ width: '100%', marginTop: 8, fontSize: 13 }}>
                  ยกเลิก
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Field observation (optional, shown when linked to no-burn) ── */}
      {noBurnReq?.id && (
        <NoBurnObservationForm noBurnRequestId={noBurnReq.id} />
      )}
    </MobileAppShell>
  );
}
