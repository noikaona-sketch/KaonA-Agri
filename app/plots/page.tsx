'use client';

import { Suspense, type CSSProperties, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { useMemberPlots } from '@/features/member-mobile/use-member-plots';
import { INVALID_PLOT_ID_MESSAGE, MISSING_PLOT_MESSAGE } from '@/features/member-mobile/plot-context';

type Plot = {
  id: string; name: string; area_rai: number;
  province: string | null; status: string;
  land_doc_type: string | null; lat: number | null; lng: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  active: '#2e7d32', pending_review: '#e65100',
  inactive: '#9e9e9e', default: '#1565c0',
};
const STATUS_TH: Record<string, string> = {
  active: 'ใช้งาน', pending_review: 'รอตรวจสอบ',
  inactive: 'ไม่ใช้งาน',
};
const DOC_TH: Record<string, string> = {
  title_deed: 'โฉนด', ns3k: 'นส.3ก', ns3: 'นส.3',
  sk1: 'สค.1', por_btor_6: 'ภบท.6', other: 'อื่นๆ',
};

function PlotsPageContent() {
  const router  = useRouter();
  const searchParams = useSearchParams();
  const requestedPlotId = searchParams.get('plot_id') ?? '';
  const { plots, loading, error, invalidPlotId, selectedPlotId, warning: plotWarning } = useMemberPlots({ selectedPlotId: requestedPlotId });
  const [notice, setNotice] = useState<string | null>(null);

  function goTo(path: string, plotId: string) {
    const params = new URLSearchParams({ plot_id: plotId });
    router.push(`${path}?${params.toString()}`);
  }

  function showPhotoNotice(plotName: string) {
    setNotice(`การจัดการรูปภาพของแปลง ${plotName} จะแยกทำใน PR ถัดไปหลังตรวจ RLS/storage policy`);
  }

  return (
      <div className="mobile-stack">
        {loading && <LoadingState label="กำลังโหลดแปลง…" />}

        {notice && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '12px 16px', color: '#1b5e20', fontSize: 14, fontWeight: 700 }}>
            ℹ️ {notice}
          </div>
        )}

        {error && (
          <div style={{ background: '#ffebee', borderRadius: 12, padding: '12px 16px', color: '#c62828', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {plotWarning && (
          <div style={{ background: '#fff8e1', borderRadius: 12, padding: '12px 16px', color: '#854F0B', fontSize: 14, fontWeight: 700 }}>
            ⚠️ {invalidPlotId ? INVALID_PLOT_ID_MESSAGE : plotWarning}
          </div>
        )}

        {!loading && !error && plots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 56 }}>🌾</div>
            <h3 style={{ margin: '12px 0 4px' }}>ยังไม่พบแปลง</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {MISSING_PLOT_MESSAGE}
            </p>
          </div>
        )}

        {plots.map((plot) => {
          const status = plot.status ?? 'default';
          const color = STATUS_COLOR[status] ?? STATUS_COLOR.default;
          return (
            <div key={plot.id} className="plot-card" style={plot.id === selectedPlotId ? { border: '2px solid #2D6A4F' } : undefined}>
              <div className="plot-card__header">
                <div>
                  <p className="plot-card__name">{plot.name}</p>
                  <div className="plot-card__meta">
                    <span className="plot-card__tag">{plot.area_rai} ไร่</span>
                    {plot.province && <span className="plot-card__tag">📍 {plot.province}</span>}
                    {plot.land_doc_type && <span className="plot-card__tag">{plot.land_doc_type ? (DOC_TH[plot.land_doc_type] ?? plot.land_doc_type) : ''}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: color + '22', color }}>
                  {STATUS_TH[status] ?? status}
                </span>
              </div>
              {plot.lat && plot.lng && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  📍 {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}
                </p>
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
          );
        })}

        <UIButton variant="secondary" fullWidth onClick={() => router.push('/plots/add')}>
          + เพิ่มแปลงใหม่
        </UIButton>
      </div>
  );
}

export default function PlotsPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer','leader','admin']}>
      <MobileAppShell title="แปลงของฉัน" subtitle="ศูนย์รวมการทำงานของเกษตรกร">
        <Suspense fallback={<LoadingState label="กำลังโหลดแปลง…" />}>
          <PlotsPageContent />
        </Suspense>
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
