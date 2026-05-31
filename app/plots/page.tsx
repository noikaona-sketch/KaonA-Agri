'use client';

import Link                    from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useRouter }           from 'next/navigation';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }              from '@/providers/auth-provider';
import { MobileAppShell }                from '@/shared/components/mobile-app-shell';
import { LoadingState }                  from '@/shared/components/loading-state';
import { ProtectedRoute }                from '@/shared/components/protected-route';
import { Weather7Day }                   from '@/features/weather/weather-widget';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Plot = {
  id: string; name: string; area_rai: number;
  province: string | null; status: string;
  land_doc_type: string | null;
  lat: number | null; lng: number | null;
};

type ActiveCycle = {
  id: string; crop_name: string; season_year: number; status: string;
  plot_id: string | null;
};

type LastLog = {
  activity_type: string; recorded_at: string;
};

type NoBurnStatus = {
  plot_id: string; status: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_LOG: { type: string; icon: string; label: string; alert?: boolean }[] = [
  { type: 'water',         icon: '💧', label: 'น้ำ'    },
  { type: 'fertilize',     icon: '🌿', label: 'ปุ๋ย'   },
  { type: 'growth_check',  icon: '📏', label: 'วัด'    },
  { type: 'pest_found',    icon: '🐛', label: 'แมลง',  alert: true },
  { type: 'heavy_rain',    icon: '🌧️', label: 'ฝน'    },
  { type: 'other',         icon: '📝', label: 'อื่นๆ'  },
];

const CYCLE_STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'วางแผน',    color: '#6b7280', bg: '#f3f4f6' },
  active:    { label: 'กำลังปลูก', color: '#1565c0', bg: '#e3f2fd' },
  confirmed: { label: 'ยืนยันแล้ว',color: '#2e7d32', bg: '#e8f5e9' },
  growing:   { label: 'กำลังโต',   color: '#2e7d32', bg: '#e8f5e9' },
  flowering: { label: 'ออกดอก',    color: '#7b1fa2', bg: '#f3e5f5' },
  maturing:  { label: 'กำลังแก่',  color: '#e65100', bg: '#fff3e0' },
  ready:     { label: 'พร้อมเก็บ', color: '#c62828', bg: '#ffebee' },
};

const NO_BURN_TH: Record<string, { icon: string; color: string }> = {
  submitted:           { icon: '⏳', color: '#854F0B' },
  under_review:        { icon: '🔍', color: '#0C447C' },
  inspection_required: { icon: '📋', color: '#3C3489' },
  approved:            { icon: '✅', color: '#27500A' },
  completed:           { icon: '✅', color: '#27500A' },
  rejected:            { icon: '⛔', color: '#444441' },
};

const DOC_TH: Record<string, string> = {
  title_deed: 'โฉนด', ns3k: 'นส.3ก', ns3: 'นส.3',
  sk1: 'สค.1', por_btor_6: 'ภบท.6', other: 'อื่นๆ',
};

function relDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 1) return 'เมื่อกี้';
  if (diff < 60) return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: r } = await sb.auth.refreshSession();
  if (r.session?.access_token) return r.session.access_token;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Log button — one-tap activity record
// ─────────────────────────────────────────────────────────────────────────────
function QuickLogBar({
  cycleId, plotId, memberId,
  onLogged,
}: {
  cycleId: string; plotId: string; memberId: string;
  onLogged: (type: string) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [done,   setDone]   = useState<string | null>(null);

  async function tap(type: string) {
    if (saving) return;
    setSaving(type);
    const sb = tryCreateSupabaseBrowserClient()!;
    await sb.from('farm_activity_logs').insert({
      planting_cycle_id: cycleId,
      member_id:         memberId,
      plot_id:           plotId,
      activity_type:     type,
      recorded_at:       new Date().toISOString(),
    });
    // Alert for pest
    if (type === 'pest_found' || type === 'disease_found') {
      void fetch('/api/member/farm-activity-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: '', activity_type: type, plot_id: plotId }),
      });
    }
    setSaving(null);
    setDone(type);
    onLogged(type);
    setTimeout(() => setDone(null), 2000);
  }

  function goTo(path: string, plotId: string) {
    const params = new URLSearchParams({ plot_id: plotId });
    router.push(`${path}?${params.toString()}`);
  }

  function showPhotoNotice(plotName: string) {
    setNotice(`การจัดการรูปภาพของแปลง ${plotName} จะแยกทำใน PR ถัดไปหลังตรวจ RLS/storage policy`);
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
      {QUICK_LOG.map((q) => {
        const isDone = done === q.type;
        const isSaving = saving === q.type;
        return (
          <button key={q.type} onClick={() => tap(q.type)} disabled={!!saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 20,
              border: `1.5px solid ${q.alert ? '#854F0B55' : isDone ? '#2e7d32' : '#e5e7eb'}`,
              background: isDone ? '#e8f5e9' : q.alert ? '#fff8f0' : '#fafafa',
              cursor: saving ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 700,
              color: isDone ? '#2e7d32' : q.alert ? '#854F0B' : '#374151',
              opacity: saving && !isSaving ? 0.5 : 1,
              transition: 'all .15s',
            }}>
            <span>{isSaving ? '⏳' : isDone ? '✓' : q.icon}</span>
            {q.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plot card — the HUB
// ─────────────────────────────────────────────────────────────────────────────
function PlotCard({
  plot, cycle, lastLog, noBurnStatus, memberId, onLogged,
}: {
  plot: Plot;
  cycle: ActiveCycle | null;
  lastLog: LastLog | null;
  noBurnStatus: string | null;
  memberId: string;
  onLogged: (plotId: string, type: string) => void;
}) {
  const st          = cycle ? (CYCLE_STATUS_TH[cycle.status] ?? CYCLE_STATUS_TH.active) : null;
  const noBurnCfg   = noBurnStatus ? NO_BURN_TH[noBurnStatus] : null;
  const hasCycle    = !!cycle;

  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: '1px solid #e8ede8',
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* ── Plot header ── */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#111' }}>{plot.name}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>📐 {plot.area_rai} ไร่</span>
              {plot.province && <span style={{ fontSize: 11, color: '#6b7280' }}>📍 {plot.province}</span>}
              {plot.land_doc_type && <span style={{ fontSize: 11, color: '#6b7280' }}>{DOC_TH[plot.land_doc_type] ?? plot.land_doc_type}</span>}
            </div>
          </div>
          {/* No-burn badge */}
          {noBurnCfg ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: noBurnCfg.color, flexShrink: 0 }}>
              {noBurnCfg.icon} งดเผา
            </span>
          ) : (
            <Link href={`/no-burn`} style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none', flexShrink: 0 }}>
              🌿 สมัครงดเผา
            </Link>
          )}
        </div>
      </div>

      {/* ── Cycle status + Quick Log (if has cycle) ── */}
      {hasCycle ? (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Link href={`/planting-cycles/${cycle.id}`} style={{ textDecoration: 'none' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>
                  🌱 {cycle.crop_name} {cycle.season_year}
                </p>
              </Link>
              {st && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, marginTop: 4, display: 'inline-block' }}>
                  {st.label}
                </span>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => goTo('/planting-cycles/new', plot.id)} style={actionButtonStyle('#2D6A4F', '#fff')}>
                  🌱 สร้างรอบปลูก
                </button>
                <button type="button" onClick={() => goTo('/service/reservations', plot.id)} style={actionButtonStyle('#185FA5', '#fff')}>
                  🌽 จองเมล็ดพันธุ์
                </button>
                <button type="button" onClick={() => goTo('/no-burn', plot.id)} style={actionButtonStyle('#388e3c', '#fff')}>
                  🌿 เข้าร่วมไม่เผา
                </button>
                <button type="button" onClick={() => showPhotoNotice(plot.name)} style={actionButtonStyle('#fff', '#2D6A4F', '#2D6A4F')}>
                  📷 เพิ่ม/ดูรูปภาพ
                </button>
              </div>
            </div>
            <Link href={`/planting-cycles/${cycle.id}/activity`}
              style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none', border: '1px solid #a5d6a7', flexShrink: 0 }}>
              ดูบันทึก
            </Link>
          </div>

          {/* Quick Log */}
          <QuickLogBar
            cycleId={cycle.id}
            plotId={plot.id}
            memberId={memberId}
            onLogged={(type) => onLogged(plot.id, type)}
          />

          {lastLog && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
              ล่าสุด: {QUICK_LOG.find(q => q.type === lastLog.activity_type)?.icon ?? '📝'}{' '}
              {QUICK_LOG.find(q => q.type === lastLog.activity_type)?.label ?? lastLog.activity_type}{' '}
              · {relDate(lastLog.recorded_at)}
            </p>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>⚪ ยังไม่มีรอบปลูก</p>
        </div>
      )}

      {/* ── Action row ── */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!hasCycle ? (
          <Link href={`/planting-cycles/new?plot_id=${plot.id}`}
            style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#2e7d32', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            🌱 เปิดรอบปลูก
          </Link>
        ) : (
          <Link href={`/planting-cycles/${cycle.id}`}
            style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#f0f4f0', color: '#374151', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            📋 รอบปลูก
          </Link>
        )}
        <Link href={`/service/reservations?plot_id=${plot.id}`}
          style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#fff8e1', color: '#e65100', fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid #ffe082' }}>
          🌽 จองเมล็ด
        </Link>
        {hasCycle && (
          <Link href={`/harvest/book?cycle_id=${cycle.id}`}
            style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#e3f2fd', color: '#1565c0', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            🚜 เกี่ยว
          </Link>
        )}
      </div>
    {/* 7-day weather */}
      {plot.lat && plot.lng && (
        <div style={{ padding: '0 14px 14px' }}>
          <Weather7Day
            lat={plot.lat}
            lng={plot.lng}
            location={plot.province ?? plot.name}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
function PlotsContent() {
  const member  = useCurrentMember();
  const router  = useRouter();

  const [plots,       setPlots]       = useState<Plot[]>([]);
  const [cycles,      setCycles]      = useState<ActiveCycle[]>([]);
  const [lastLogs,    setLastLogs]    = useState<Record<string, LastLog>>({});
  const [noBurnMap,   setNoBurnMap]   = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  async function load() {
    if (!member?.member_id) return;
    setLoading(true);
    const token = await getBearerToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // 1) Plots + cycles + no-burn in parallel
    const [plotsRes, cyclesRes] = await Promise.all([
      fetch(`/api/member/plots?member_id=${member.member_id}`, { headers })
        .then(r => r.json() as Promise<{ plots?: Plot[] }>),
      fetch(`/api/member/planting-cycles?member_id=${member.member_id}`, { headers })
        .then(r => r.json() as Promise<{ cycles?: ActiveCycle[] }>),
    ]);

    const loadedPlots  = plotsRes.plots ?? [];
    const loadedCycles = cyclesRes.cycles ?? [];
    setPlots(loadedPlots);
    setCycles(loadedCycles);

    if (loadedPlots.length === 0) { setLoading(false); return; }

    // 2) Last farm log per plot + no-burn status (silent)
    const sb = tryCreateSupabaseBrowserClient();
    if (sb && member.member_id) {
      const plotIds = loadedPlots.map(p => p.id);

      const [logsRes, noBurnRes] = await Promise.all([
        sb.from('farm_activity_logs')
          .select('plot_id,activity_type,recorded_at')
          .in('plot_id', plotIds)
          .eq('member_id', member.member_id)
          .order('recorded_at', { ascending: false })
          .limit(50),
        sb.from('no_burn_requests')
          .select('plot_id,status')
          .in('plot_id', plotIds)
          .eq('member_id', member.member_id)
          .is('deleted_at', null)
          .not('status', 'in', '(rejected,completed)'),
      ]);

      // Build last-log map (first occurrence = most recent per plot)
      const logMap: Record<string, LastLog> = {};
      for (const row of (logsRes.data ?? []) as (LastLog & { plot_id: string })[]) {
        if (!logMap[row.plot_id]) logMap[row.plot_id] = row;
      }
      setLastLogs(logMap);

      // Build no-burn map
      const nbMap: Record<string, string> = {};
      for (const row of (noBurnRes.data ?? []) as NoBurnStatus[]) {
        nbMap[row.plot_id] = row.status;
      }
      setNoBurnMap(nbMap);
    }

    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  function onLogged(plotId: string, type: string) {
    setLastLogs(prev => ({
      ...prev,
      [plotId]: { activity_type: type, recorded_at: new Date().toISOString() },
    }));
  }

  if (loading) return <LoadingState label="กำลังโหลดแปลง…" />;

  return (
    <div className="mobile-stack">
      {error && (
        <div style={{ background: '#ffebee', borderRadius: 12, padding: '12px 16px', color: '#c62828', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {plots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 56 }}>🌾</div>
          <h3 style={{ margin: '12px 0 4px' }}>ยังไม่มีแปลง</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            เพิ่มแปลงเกษตรเพื่อเริ่มติดตามการเพาะปลูก
          </p>
          <button onClick={() => router.push('/plots/add')}
            style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + เพิ่มแปลงแรก
          </button>
        </div>
      )}

      {plots.map((plot) => {
        const cycle = cycles.find(c => c.plot_id === plot.id) ?? null;
        return (
          <PlotCard
            key={plot.id}
            plot={plot}
            cycle={cycle}
            lastLog={lastLogs[plot.id] ?? null}
            noBurnStatus={noBurnMap[plot.id] ?? null}
            memberId={member!.member_id}
            onLogged={onLogged}
          />
        );
      })}

      <button onClick={() => router.push('/plots/add')}
        style={{
          width: '100%', padding: '13px', borderRadius: 14,
          border: '1.5px dashed #d1d5db', background: '#fafafa',
          color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
        + เพิ่มแปลงใหม่
      </button>
    </div>
  );
}

export default function PlotsPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <MobileAppShell title="🌾 ไร่ของฉัน" subtitle="แปลง · รอบปลูก · กิจกรรม">
        <PlotsContent />
      </MobileAppShell>
    </ProtectedRoute>
  );
}

function actionButtonStyle(background: string, color: string, borderColor?: string): CSSProperties {
  return {
    border: borderColor ? `1.5px solid ${borderColor}` : 'none',
    borderRadius: 12,
    background,
    color,
    padding: '10px 8px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 44,
    textAlign: 'center',
  };
}
