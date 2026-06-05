'use client';

// NearMeList — สมาชิกใกล้ฉัน เรียงระยะทาง
// - จับ GPS ทันที ไม่ต้องกด
// - แสดง 5-10 ราย เรียงจากใกล้→ไกล
// - แต่ละ card: ชื่อ, ระยะ, ไร่, สถานะ, ปุ่มโทร + Google Maps

import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type PlotRow = {
  id: string; name: string;
  lat: number; lng: number; area_rai: number;
  province: string | null; district: string | null;
  status: string;
  member: { id: string; full_name: string; phone: string | null } | null;
};

type NearbyItem = PlotRow & { distanceM: number };

// Haversine — distance in metres
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371000;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} ม.`;
  return `${(m / 1000).toFixed(1)} กม.`;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active:         { label: 'ใช้งาน',    color: '#14532d', bg: '#f0fdf4' },
  pending_review: { label: 'รอตรวจ',   color: '#92400e', bg: '#fffbeb' },
  inactive:       { label: 'ไม่ใช้งาน', color: '#6b7280', bg: '#f3f4f6' },
};

export function NearMeList() {
  const [myPos,   setMyPos]   = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [items,   setItems]   = useState<NearbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsErr,  setGpsErr]  = useState<string | null>(null);
  const [radius,  setRadius]  = useState(5); // km
  const [limit,   setLimit]   = useState(10);

  // ── 1. จับ GPS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      err => { setGpsErr(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  // ── 2. โหลด plots เมื่อได้ GPS ────────────────────────────────────────────
  useEffect(() => {
    if (!myPos) return;
    void loadNearby(myPos.lat, myPos.lng);
  }, [myPos, radius]);

  async function loadNearby(lat: number, lng: number) {
    setLoading(true);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }

    // bbox filter — 1 degree lat ≈ 111km
    const pad = radius / 111 * 1.2;
    const { data } = await sb
      .from('plots')
      .select('id,name,lat,lng,area_rai,province,district,status,member:member_id(id,full_name,phone)')
      .not('lat', 'is', null).not('lng', 'is', null)
      .is('deleted_at', null)
      .gte('lat', lat - pad).lte('lat', lat + pad)
      .gte('lng', lng - pad * 1.5).lte('lng', lng + pad * 1.5)
      .limit(200);

    const rows = (data as PlotRow[]) ?? [];

    // คำนวณระยะ + filter + เรียง
    const nearby: NearbyItem[] = rows
      .map(r => ({ ...r, distanceM: haversineM(lat, lng, r.lat, r.lng) }))
      .filter(r => r.distanceM <= radius * 1000)
      .sort((a, b) => a.distanceM - b.distanceM);

    setItems(nearby);
    setLoading(false);
  }

  function retry() {
    setGpsErr(null); setLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      err => { setGpsErr(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  // ── GPS Error ───────────────────────────────────────────────────────────────
  if (gpsErr) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 40 }}>📡</div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>จับ GPS ไม่สำเร็จ</p>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{gpsErr}</p>
      <button onClick={retry}
        style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        ลองใหม่
      </button>
    </div>
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📡</div>
      <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
        {!myPos ? 'กำลังจับพิกัด GPS…' : 'กำลังค้นหาสมาชิกใกล้ฉัน…'}
      </p>
    </div>
  );

  const shown = items.slice(0, limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* GPS + radius bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {myPos && (
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: '#f0fdf4', color: '#166534', fontWeight: 600 }}>
            📍 ±{Math.round(myPos.acc)}ม.
          </span>
        )}
        <span style={{ fontSize: 12, color: '#6b7280' }}>รัศมี:</span>
        {[1, 3, 5, 10, 20].map(r => (
          <button key={r} onClick={() => setRadius(r)}
            style={{ padding: '4px 10px', borderRadius: 99, border: `1.5px solid ${radius === r ? '#2e7d32' : '#e5e7eb'}`, background: radius === r ? '#e8f5e9' : '#fff', color: radius === r ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {r} กม.
          </button>
        ))}
      </div>

      {/* Summary */}
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
        พบ <strong style={{ color: '#111' }}>{items.length}</strong> แปลง ในรัศมี {radius} กม.
        {items.length > limit ? ` (แสดง ${limit} แรก)` : ''}
      </p>

      {/* Empty */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌾</div>
          <p style={{ fontSize: 13 }}>ไม่พบแปลงในรัศมี {radius} กม.</p>
          <p style={{ fontSize: 12 }}>ลองขยายรัศมีด้านบน</p>
        </div>
      )}

      {/* List */}
      {shown.map(item => {
        const st  = STATUS_CFG[item.status] ?? STATUS_CFG.active;
        const nav = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
        return (
          <div key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            {/* Main row */}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Distance badge */}
              <div style={{ flexShrink: 0, width: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: item.distanceM < 500 ? '#dc2626' : item.distanceM < 2000 ? '#d97706' : '#2e7d32' }}>
                  {fmtDist(item.distanceM)}
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>จากฉัน</div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.member?.full_name ?? '—'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  🌱 {item.name} · {item.area_rai} ไร่
                  {item.district ? ` · ${item.district}` : item.province ? ` · ${item.province}` : ''}
                </p>
              </div>

              {/* Status */}
              <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 700 }}>
                {st.label}
              </span>
            </div>

            {/* Action row */}
            <div style={{ borderTop: '1px solid #f3f4f6', display: 'flex' }}>
              {item.member?.phone ? (
                <a href={`tel:${item.member.phone}`}
                  style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', borderRight: '1px solid #f3f4f6' }}>
                  📞 โทร
                </a>
              ) : (
                <span style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, color: '#d1d5db' }}>
                  ไม่มีเบอร์
                </span>
              )}
              <a href={nav} target="_blank" rel="noreferrer"
                style={{ flex: 2, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#fff', background: '#1a73e8', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                🗺️ นำทาง Google Maps
              </a>
            </div>
          </div>
        );
      })}

      {/* Show more */}
      {items.length > limit && (
        <button onClick={() => setLimit(l => l + 10)}
          style={{ padding: '11px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ดูเพิ่มอีก {Math.min(10, items.length - limit)} ราย จาก {items.length - limit} ที่เหลือ
        </button>
      )}
    </div>
  );
}
