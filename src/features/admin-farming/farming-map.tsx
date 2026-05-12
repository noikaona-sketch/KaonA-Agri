'use client';

import { useEffect, useRef, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type MapPlot = {
  cycle_id: string;
  member_name: string;
  crop_name: string;
  plot_name: string;
  province: string | null;
  planted_at: string | null;
  harvest_date_estimated: string | null;
  days_to_harvest: number | null;
  area_planted_rai: number | null;
  estimated_yield_kg: number | null;
  estimated_revenue: number | null;
  price_per_kg: number | null;
  map_color: string;
  lat: number;
  lng: number;
  status: string;
};

const COLOR_MAP: Record<string, string> = {
  green: '#2e7d32', orange: '#e65100', red: '#c62828', grey: '#9e9e9e', blue: '#1565c0',
};
const COLOR_LABEL: Record<string, string> = {
  green: 'กำลังปลูก', orange: 'ใกล้เก็บ (<30 วัน)', red: 'พร้อมเก็บ (<14 วัน)', grey: 'เสร็จแล้ว',
};

export function FarmingMap() {
  const mapRef   = useRef<HTMLDivElement>(null);
  const leafRef  = useRef<unknown>(null);
  const [plots, setPlots]     = useState<MapPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MapPlot | null>(null);
  const [filterColor, setFilterColor] = useState('');

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('farming_map_view').select('*');
      setPlots((data as MapPlot[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading || !mapRef.current || plots.length === 0) return;
    if (leafRef.current) return; // ไม่ init ซ้ำ

    void (async () => {
      // โหลด Leaflet แบบ dynamic (ไม่ต้อง install)
      const L = await import('leaflet' as string) as unknown as typeof import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current) return;

      // หา center จาก plots
      const validPlots = plots.filter((p) => p.lat && p.lng);
      const avgLat = validPlots.reduce((s, p) => s + p.lat, 0) / validPlots.length;
      const avgLng = validPlots.reduce((s, p) => s + p.lng, 0) / validPlots.length;

      const map = L.map(mapRef.current).setView([avgLat || 15.0, avgLng || 102.0], 10);
      leafRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      validPlots.forEach((p) => {
        const color = COLOR_MAP[p.map_color] ?? '#2e7d32';
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 10,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        });

        const harvestText = p.days_to_harvest != null
          ? p.days_to_harvest > 0 ? `เก็บใน ${p.days_to_harvest} วัน` : 'พร้อมเก็บเกี่ยว'
          : 'ไม่ระบุ';

        marker.bindTooltip(
          `<strong>${p.crop_name}</strong><br/>` +
          `${p.plot_name} · ${p.member_name}<br/>` +
          `${harvestText}<br/>` +
          `~${(p.estimated_yield_kg ?? 0).toLocaleString()} กก.`,
          { permanent: false, direction: 'top' }
        );

        marker.on('click', () => setSelected(p));
        marker.addTo(map);
      });
    })();
  }, [loading, plots]);

  const displayPlots = filterColor ? plots.filter((p) => p.map_color === filterColor) : plots;
  const summary = {
    total: plots.length,
    ready: plots.filter((p) => p.map_color === 'red').length,
    soon: plots.filter((p) => p.map_color === 'orange').length,
    totalYield: plots.reduce((s, p) => s + (p.estimated_yield_kg ?? 0), 0),
    totalRevenue: plots.reduce((s, p) => s + (p.estimated_revenue ?? 0), 0),
  };

  if (loading) return <LoadingState label="กำลังโหลดข้อมูลแผนที่…" />;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI summary */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { icon: '🌾', label: 'แปลงทั้งหมด', value: summary.total, color: '#e8f5e9' },
          { icon: '🔴', label: 'พร้อมเก็บ', value: summary.ready, color: '#ffebee' },
          { icon: '🟠', label: 'ใกล้เก็บ', value: summary.soon, color: '#fff3e0' },
          { icon: '📦', label: 'ประมาณผลผลิต', value: `${(summary.totalYield / 1000).toFixed(1)} ตัน`, color: '#e3f2fd' },
          { icon: '💰', label: 'ประมาณรายได้', value: `${(summary.totalRevenue / 1000).toFixed(0)}K บาท`, color: '#f3e5f5' },
        ].map((k) => (
          <div key={k.label} className="admin-kpi-card" style={{ background: k.color }}>
            <div className="admin-kpi-icon">{k.icon}</div>
            <div className="admin-kpi-value">{k.value}</div>
            <div className="admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Legend + filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#4a6741' }}>แสดง:</span>
        <button className={`admin-btn ${!filterColor ? 'admin-btn--primary' : 'admin-btn--secondary'}`} onClick={() => setFilterColor('')} style={{ fontSize: 12, minHeight: 32, padding: '4px 10px' }}>ทั้งหมด</button>
        {Object.entries(COLOR_LABEL).map(([color, label]) => (
          <button key={color} onClick={() => setFilterColor(color === filterColor ? '' : color)}
            className={`admin-btn ${filterColor === color ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 12, minHeight: 32, padding: '4px 10px', borderLeft: `4px solid ${COLOR_MAP[color]}` }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        {/* Map */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid #e8ede8', height: 500 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {plots.filter((p) => p.lat && p.lng).length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7faf7', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 40 }}>🗺️</div>
              <p style={{ margin: 0, color: '#6b7280' }}>ไม่มีแปลงที่มีพิกัด GPS</p>
            </div>
          )}
        </div>

        {/* Selected plot detail */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e8ede8', borderRadius: 14, padding: 20, display: 'grid', gap: 12, alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>{selected.plot_name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            <div style={{ borderLeft: `4px solid ${COLOR_MAP[selected.map_color]}`, paddingLeft: 10 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{selected.crop_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{selected.member_name}</p>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  {[
                    ['จังหวัด', selected.province ?? '—'],
                    ['พื้นที่', `${selected.area_planted_rai ?? '—'} ไร่`],
                    ['ปลูกเมื่อ', selected.planted_at ? new Date(selected.planted_at).toLocaleDateString('th-TH') : '—'],
                    ['คาดเก็บ', selected.harvest_date_estimated ? new Date(selected.harvest_date_estimated).toLocaleDateString('th-TH') : '—'],
                    ['เหลืออีก', selected.days_to_harvest != null ? (selected.days_to_harvest > 0 ? `${selected.days_to_harvest} วัน` : 'พร้อมเก็บ') : '—'],
                    ['คาดผลผลิต', `${(selected.estimated_yield_kg ?? 0).toLocaleString()} กก.`],
                    ['ราคา/กก.', `${selected.price_per_kg ?? '—'} บาท`],
                    ['คาดรายได้', `${(selected.estimated_revenue ?? 0).toLocaleString()} บาท`],
                  ].map(([k, v]) => (
                    <tr key={String(k)}>
                      <td style={{ background: '#f7faf7', fontWeight: 600, width: 100, fontSize: 12, color: '#4a6741' }}>{k}</td>
                      <td style={{ fontSize: 13 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <a href={`/admin/farming/harvest?cycle=${selected.cycle_id}`} className="admin-btn admin-btn--primary" style={{ justifyContent: 'center', padding: '10px' }}>
              🚜 นัดรถเกี่ยว
            </a>
            <a href={`/admin/appointments/new?cycle=${selected.cycle_id}`} className="admin-btn admin-btn--secondary" style={{ justifyContent: 'center', padding: '10px' }}>
              📅 นัดขาย
            </a>
          </div>
        )}
      </div>

      {/* Plot list below map */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>แปลง</th><th>สมาชิก</th><th>พืช</th><th>ไร่</th><th>คาดเก็บ</th><th>เหลือ</th><th>ผลผลิต (กก.)</th><th>รายได้ (บาท)</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {displayPlots.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>ไม่มีข้อมูล</td></tr>}
            {displayPlots.map((p) => (
              <tr key={p.cycle_id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                <td style={{ fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_MAP[p.map_color], display: 'inline-block', marginRight: 8 }} />
                  {p.plot_name}
                </td>
                <td>{p.member_name}</td>
                <td style={{ fontWeight: 600 }}>{p.crop_name}</td>
                <td>{p.area_planted_rai ?? '—'}</td>
                <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {p.harvest_date_estimated ? new Date(p.harvest_date_estimated).toLocaleDateString('th-TH') : '—'}
                </td>
                <td>
                  {p.days_to_harvest != null ? (
                    <span className={`status-badge ${p.days_to_harvest <= 14 ? 'status-badge--rejected' : p.days_to_harvest <= 30 ? 'status-badge--pending' : 'status-badge--approved'}`}>
                      {p.days_to_harvest > 0 ? `${p.days_to_harvest} วัน` : 'พร้อมเก็บ'}
                    </span>
                  ) : '—'}
                </td>
                <td>{(p.estimated_yield_kg ?? 0).toLocaleString()}</td>
                <td>{(p.estimated_revenue ?? 0).toLocaleString()}</td>
                <td>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: COLOR_MAP[p.map_color] + '22', color: COLOR_MAP[p.map_color], fontWeight: 700 }}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
