'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import type { FieldMarker } from './field-team-map-inner';

const FieldMapInner = dynamic(() => import('./field-team-map-inner'), { ssr: false,
  loading: () => <div style={{ height: 340, borderRadius: 16, background: '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>กำลังโหลดแผนที่…</div>,
});

type MemberPlot = {
  id: string; name: string; lat: number | null; lng: number | null;
  province: string | null;
  members: { id: string; full_name: string; phone: string | null }[] | null;
};

export function FieldTeamMap() {
  const member = useCurrentMember();
  const [markers, setMarkers]   = useState<FieldMarker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selfLat, setSelfLat]   = useState<number | null>(null);
  const [selfLng, setSelfLng]   = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter]     = useState<'all' | 'members' | 'plots'>('all');

  // โหลดแปลงสมาชิกทั้งหมด
  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('plots')
        .select('id,name,lat,lng,province,members(id,full_name,phone)')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .is('deleted_at', null)
        .limit(200);

      const plots = (data as MemberPlot[]) ?? [];
      const built: FieldMarker[] = plots.map((p) => ({
        id:       `plot-${p.id}`,
        type:     'plot' as const,
        lat:      p.lat!,
        lng:      p.lng!,
        label:    p.name,
        sublabel: `${p.members?.[0]?.full_name ?? '—'} · ${p.province ?? ''}`,
        phone:    p.members?.[0]?.phone,
      }));
      setMarkers(built);
      setLoading(false);
    })();
  }, []);

  // จับพิกัดตัวเอง
  function locateSelf() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelfLat(pos.coords.latitude);
        setSelfLng(pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const filtered = filter === 'all' ? markers
    : markers.filter((m) => m.type === filter.slice(0, -1) as FieldMarker['type']);

  const plotCount   = markers.filter((m) => m.type === 'plot').length;

  return (
    <div className="mobile-stack">
      {/* header stats */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="kaona-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>{plotCount}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>🌾 แปลงบนแผนที่</p>
        </div>
        <div className="kaona-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: selfLat ? '#2e7d32' : '#9ca3af' }}>
            {selfLat ? '✅' : '—'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>📍 จุดของคุณ</p>
        </div>
      </div>

      {/* ปุ่มจับพิกัดตัวเอง */}
      <button onClick={locateSelf} disabled={locating}
        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '2px solid var(--primary)', background: selfLat ? '#e8f5e9' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {locating ? '📍 กำลังหาตำแหน่ง…' : selfLat ? `✅ พบตำแหน่ง (${selfLat.toFixed(4)}, ${selfLng!.toFixed(4)})` : '📍 ระบุตำแหน่งของฉัน'}
      </button>

      {/* filter tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'plots'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: filter === f ? 'var(--primary)' : '#f0f4f0', color: filter === f ? '#fff' : 'var(--text-secondary)' }}>
            {f === 'all' ? `ทั้งหมด (${markers.length})` : `🌾 แปลง (${plotCount})`}
          </button>
        ))}
      </div>

      {/* map */}
      {loading ? <LoadingState label="กำลังโหลดข้อมูลแผนที่…" /> : (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #e4ebe4', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <FieldMapInner
            markers={filtered}
            selfLat={selfLat}
            selfLng={selfLng}
          />
        </div>
      )}

      {/* legend */}
      <div className="kaona-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <span>📍 <b>ตำแหน่งของคุณ</b></span>
          <span>🌾 <b>แปลงสมาชิก</b> — กดเพื่อโทร / นำทาง</span>
        </div>
      </div>
    </div>
  );
}
