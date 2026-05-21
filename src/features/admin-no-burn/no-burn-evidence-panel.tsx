'use client';

import { useEffect, useState } from 'react';

type Photo = {
  id: string;
  signed_url: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  gps_source: string;
  gps_is_mocked: boolean;
  evidence_status: string;
  captured_at: string | null;
  gps_distance_to_plot_m: number | null;
};

const EVIDENCE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  submitted:    { label: 'รอตรวจ',      color: '#854F0B', bg: '#FAEEDA' },
  accepted:     { label: '✅ ยืนยัน',   color: '#27500A', bg: '#EAF3DE' },
  rejected:     { label: '❌ ปฏิเสธ',   color: '#791F1F', bg: '#FCEBEB' },
  needs_review: { label: '⚠️ ต้องดูซ้ำ', color: '#185FA5', bg: '#E6F1FB' },
};

function gpsTag(p: Photo) {
  if (p.gps_is_mocked) return { label: '⚠️ GPS ปลอม', color: '#c62828' };
  if (p.gps_source === 'manual') return { label: '📌 กรอกเอง', color: '#854F0B' };
  return { label: '📡 GPS อุปกรณ์', color: '#27500A' };
}

type Props = { requestId: string };

export function NoBurnEvidencePanel({ requestId }: Props) {
  const [photos,  setPhotos]  = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/no-burn/photos?request_id=${requestId}`);
    const d   = (await res.json()) as { photos?: Photo[] };
    setPhotos(d.photos ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [requestId]);

  async function setStatus(photoId: string, status: 'accepted' | 'rejected' | 'needs_review') {
    setActing(photoId);
    await fetch('/api/admin/no-burn/photos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_id: photoId, evidence_status: status }),
    });
    setActing(null);
    void load();
  }

  if (loading) return <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>กำลังโหลดรูป…</p>;
  if (photos.length === 0) return <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>ไม่มีรูปหลักฐาน</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {photos.map((p, i) => {
        const tag = gpsTag(p);
        const st  = EVIDENCE_STATUS[p.evidence_status] ?? EVIDENCE_STATUS.submitted;
        const mapsUrl = p.lat && p.lng ? `https://maps.google.com/?q=${p.lat},${p.lng}` : null;
        const dist = p.gps_distance_to_plot_m != null
          ? p.gps_distance_to_plot_m < 1000
            ? `${Math.round(p.gps_distance_to_plot_m)} ม.`
            : `${(p.gps_distance_to_plot_m / 1000).toFixed(1)} กม.`
          : null;

        return (
          <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#fafafa' }}>
            {/* รูปและ GPS ด้านบน */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {/* thumbnail */}
              {p.signed_url && (
                <a href={p.signed_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                  <img src={p.signed_url} alt={`รูป ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </a>
              )}

              {/* GPS info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: tag.color }}>
                    {tag.label}
                  </span>
                  {p.accuracy != null && (
                    <span style={{ fontSize: 10, color: '#6b7280' }}>±{Math.round(p.accuracy)} ม.</span>
                  )}
                </div>

                {p.lat && p.lng ? (
                  <p style={{ margin: 0, fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                    {dist && <span style={{ marginLeft: 6, color: p.gps_distance_to_plot_m! > 500 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                      ({dist}จากแปลง)
                    </span>}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>ไม่มีพิกัด</p>
                )}

                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: '#1565c0', display: 'inline-block', marginTop: 2 }}>
                    🗺️ เปิดใน Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* ปุ่มตรวจสอบ */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {(['accepted', 'needs_review', 'rejected'] as const).map((s) => {
                const cfg = EVIDENCE_STATUS[s];
                const isActive = p.evidence_status === s;
                return (
                  <button key={s} disabled={!!acting}
                    onClick={() => setStatus(p.id, s)}
                    style={{
                      flex: 1, fontSize: 10, padding: '3px 4px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${cfg.color}`,
                      background: isActive ? cfg.bg : 'transparent',
                      color: cfg.color, fontWeight: isActive ? 700 : 400,
                      opacity: acting ? 0.6 : 1,
                    }}>
                    {acting === p.id ? '…' : cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
