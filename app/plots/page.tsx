'use client';

import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';
import { ProtectedRoute } from '@/shared/components/protected-route';

const PHOTO_BUCKET = 'member-photos';

type Plot = {
  id: string; name: string; area_rai: number;
  province: string | null; status: string;
  land_doc_type: string | null; lat: number | null; lng: number | null;
};

type PlotPhoto = {
  id: string;
  plot_id: string | null;
  storage_path: string;
  photo_type: string | null;
  captured_at: string | null;
  created_at: string | null;
  signedUrl?: string | null;
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
  const [photos, setPhotos] = useState<Record<string, PlotPhoto[]>>({});
  const [expandedPhotoPlotId, setExpandedPhotoPlotId] = useState<string | null>(null);
  const [uploadingPlotId, setUploadingPlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const photoCounts = useMemo(() => {
    return Object.fromEntries(Object.entries(photos).map(([plotId, list]) => [plotId, list.length]));
  }, [photos]);

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      try {
        const params = new URLSearchParams({ line_user_id: member.line_user_id });
        const res = await fetch(`/api/member/plots?${params.toString()}`);
        const payload = (await res.json()) as { plots?: Plot[]; error?: string };
        if (!res.ok) {
          setError(payload.error ?? 'ไม่สามารถโหลดแปลงได้');
        } else {
          const nextPlots = payload.plots ?? [];
          setPlots(nextPlots);
          await loadPhotos(nextPlots.map((plot) => plot.id));
        }
      } catch (e) {
        setError(String(e));
      }
      setLoading(false);
    })();
  }, [member?.member_id, member?.line_user_id]);

  async function loadPhotos(plotIds: string[]) {
    if (!plotIds.length) {
      setPhotos({});
      return;
    }
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    const { data, error: photoError } = await sb
      .from('photos')
      .select('id,plot_id,storage_path,photo_type,captured_at,created_at')
      .in('plot_id', plotIds)
      .order('created_at', { ascending: false })
      .limit(80);
    if (photoError) return;

    const rows = ((data ?? []) as PlotPhoto[]).filter((photo) => photo.plot_id);
    const signedRows = await Promise.all(rows.map(async (photo) => {
      const { data: signed } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path, 60 * 10);
      return { ...photo, signedUrl: signed?.signedUrl ?? null };
    }));
    const grouped: Record<string, PlotPhoto[]> = {};
    for (const plotId of plotIds) grouped[plotId] = [];
    for (const photo of signedRows) {
      if (!photo.plot_id) continue;
      grouped[photo.plot_id] = [...(grouped[photo.plot_id] ?? []), photo];
    }
    setPhotos(grouped);
  }

  async function handlePhotoUpload(plot: Plot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !member?.member_id) return;
    setUploadingPlotId(plot.id);
    setError(null);
    setNotice(null);

    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) {
      setError('ไม่สามารถเชื่อมต่อระบบรูปภาพได้');
      setUploadingPlotId(null);
      return;
    }

    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }),
        );
        gpsLat = pos.coords.latitude;
        gpsLng = pos.coords.longitude;
      } catch { /* optional GPS — continue */ }
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const storagePath = `${member.member_id}/plots/${plot.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await sb.storage.from(PHOTO_BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (uploadError) {
      setError(uploadError.message || 'อัปโหลดรูปไม่สำเร็จ');
      setUploadingPlotId(null);
      return;
    }

    const { error: insertError } = await sb.from('photos').insert({
      member_id: member.member_id,
      plot_id: plot.id,
      storage_path: storagePath,
      photo_type: 'plot',
      lat: gpsLat,
      lng: gpsLng,
      captured_at: new Date().toISOString(),
      uploaded_by: member.member_id,
    });
    if (insertError) {
      setError(insertError.message || 'บันทึกข้อมูลรูปไม่สำเร็จ');
      setUploadingPlotId(null);
      return;
    }

    setNotice(`เพิ่มรูปให้แปลง ${plot.name} แล้ว`);
    setExpandedPhotoPlotId(plot.id);
    await loadPhotos(plots.map((p) => p.id));
    setUploadingPlotId(null);
  }

  function goTo(path: string, plotId: string) {
    const params = new URLSearchParams({ plot_id: plotId });
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <ProtectedRoute allowedRoles={['farmer','leader','admin']}>
      <MobileAppShell title="แปลงของฉัน" subtitle="ศูนย์รวมการทำงานของเกษตรกร">
      <div className="mobile-stack">
        {loading && <LoadingState label="กำลังโหลดแปลง…" />}

        {notice && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '12px 16px', color: '#1b5e20', fontSize: 14, fontWeight: 700 }}>
            ✅ {notice}
          </div>
        )}

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
          const isPhotosOpen = expandedPhotoPlotId === plot.id;
          const plotPhotos = photos[plot.id] ?? [];
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
                <button type="button" onClick={() => setExpandedPhotoPlotId(isPhotosOpen ? null : plot.id)} style={actionButtonStyle('#fff', '#2D6A4F', '#2D6A4F')}>
                  📷 รูปภาพ ({photoCounts[plot.id] ?? 0})
                </button>
              </div>

              {isPhotosOpen && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: '#f8faf8', border: '1px solid #e0eadf' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: '1.5px dashed #9ab89b', color: '#2D6A4F', fontWeight: 800, fontSize: 13, cursor: uploadingPlotId === plot.id ? 'default' : 'pointer', background: '#fff' }}>
                    {uploadingPlotId === plot.id ? '⏳ กำลังอัปโหลด…' : '+ เพิ่มรูปแปลง'}
                    <input type="file" accept="image/*" capture="environment" disabled={uploadingPlotId === plot.id} onChange={(event) => void handlePhotoUpload(plot, event)} style={{ display: 'none' }} />
                  </label>

                  {plotPhotos.length === 0 ? (
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>ยังไม่มีรูปภาพสำหรับแปลงนี้</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                      {plotPhotos.slice(0, 9).map((photo) => (
                        <a key={photo.id} href={photo.signedUrl ?? '#'} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#e5e7eb' }}>
                          {photo.signedUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo.signedUrl} alt={`รูปภาพแปลง ${plot.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 22 }}>📷</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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
