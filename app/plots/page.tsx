'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';
import { ProtectedRoute } from '@/shared/components/protected-route';

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

export default function PlotsPage() {
  const member = useCurrentMember();
  const router  = useRouter();
  const [plots, setPlots]     = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      try {
        const params = new URLSearchParams({ line_user_id: member.line_user_id });
        const res = await fetch(`/api/member/plots?${params.toString()}`);
        const payload = (await res.json()) as { plots?: Plot[]; error?: string };
        if (!res.ok) setError(payload.error ?? 'ไม่สามารถโหลดแปลงได้');
        else setPlots(payload.plots ?? []);
      } catch (e) {
        setError(String(e));
      }
      setLoading(false);
    })();
  }, [member?.member_id, member?.line_user_id]);

  return (
    <ProtectedRoute allowedRoles={['farmer','leader','admin']}>
      <MobileAppShell title="แปลงของฉัน" subtitle="จัดการแปลงเกษตรทั้งหมด">
      <div className="mobile-stack">
        {loading && <LoadingState label="กำลังโหลดแปลง…" />}

        {error && (
          <div style={{ background: '#ffebee', borderRadius: 12, padding: '12px 16px', color: '#c62828', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && plots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 56 }}>🌾</div>
            <h3 style={{ margin: '12px 0 4px' }}>ยังไม่มีแปลง</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              เพิ่มแปลงเกษตรของคุณเพื่อเริ่มติดตามการเพาะปลูก
            </p>
          </div>
        )}

        {plots.map((plot) => {
          const color = STATUS_COLOR[plot.status] ?? STATUS_COLOR.default;
          return (
            <div key={plot.id} className="plot-card">
              <div className="plot-card__header">
                <div>
                  <p className="plot-card__name">{plot.name}</p>
                  <div className="plot-card__meta">
                    <span className="plot-card__tag">{plot.area_rai} ไร่</span>
                    {plot.province && <span className="plot-card__tag">📍 {plot.province}</span>}
                    {plot.land_doc_type && <span className="plot-card__tag">{DOC_TH[plot.land_doc_type] ?? plot.land_doc_type}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: color + '22', color }}>
                  {STATUS_TH[plot.status] ?? plot.status}
                </span>
              </div>
              {plot.lat && plot.lng && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  📍 {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}
                </p>
              )}
            </div>
          );
        })}

        <UIButton variant="secondary" fullWidth onClick={() => router.push('/plots/add')}>
          + เพิ่มแปลงใหม่
        </UIButton>
      </div>
    </MobileAppShell>
    </ProtectedRoute>
  );
}
