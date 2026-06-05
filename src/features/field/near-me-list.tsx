'use client';

// NearMeList v2 — สมาชิกใกล้ฉัน 3 mode:
// 'plot'    — ระยะจากพิกัดแปลง (แม่นสำหรับแปลงที่มี GPS)
// 'address' — ระยะจากที่อยู่ทะเบียน (lat/lng ของสมาชิก ถ้ามี)
// 'both'    — รวมทั้งสอง deduplicate ด้วย member_id เอาอันใกล้สุด

import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
type PlotRow = {
  id: string; name: string; lat: number; lng: number;
  area_rai: number; province: string | null; district: string | null; status: string;
  member: { id: string; full_name: string; phone: string | null } | null;
};

type MemberRow = {
  id: string; full_name: string; phone: string | null;
  lat: number | null; lng: number | null;
  province: string | null; district: string | null; subdistrict: string | null;
  address: string | null;
};

type NearbyItem = {
  key: string;           // unique: plotId or 'member-{memberId}'
  memberId: string;
  memberName: string;
  phone: string | null;
  distanceM: number;
  source: 'plot' | 'address' | 'both';
  // plot info (may be null for address-only)
  plotId: string | null;
  plotName: string | null;
  areaRai: number | null;
  plotStatus: string | null;
  // location
  lat: number; lng: number;
  locationLabel: string;  // "แปลง xxx" or "ที่อยู่ทะเบียน"
};

type SourceMode = 'plot' | 'address' | 'both';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const DIST_COLOR = (m: number) =>
  m < 500 ? '#dc2626' : m < 2000 ? '#d97706' : '#2e7d32';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active:         { label: 'ใช้งาน',    color: '#14532d', bg: '#f0fdf4' },
  pending_review: { label: 'รอตรวจ',    color: '#92400e', bg: '#fffbeb' },
  inactive:       { label: 'ไม่ใช้งาน', color: '#6b7280', bg: '#f3f4f6' },
};

const MODE_CFG: { key: SourceMode; label: string; desc: string }[] = [
  { key: 'plot',    label: '🌾 ตามแปลง',      desc: 'ใช้ GPS พิกัดแปลงที่บันทึกไว้' },
  { key: 'address', label: '🏠 ตามทะเบียน',   desc: 'ใช้ที่อยู่ทะเบียนสมาชิก' },
  { key: 'both',    label: '🔍 ทั้งสอง',       desc: 'รวมกัน เอาอันใกล้สุดต่อคน' },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function NearMeList() {
  const [myPos,    setMyPos]    = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsErr,   setGpsErr]   = useState<string | null>(null);
  const [mode,     setMode]     = useState<SourceMode>('both');
  const [radius,   setRadius]   = useState(5);
  const [limit,    setLimit]    = useState(10);
  const [items,    setItems]    = useState<NearbyItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [counts,   setCounts]   = useState({ plot: 0, address: 0 });

  // Auto GPS on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      err => { setGpsErr(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  // Load when GPS ready or mode/radius changes
  useEffect(() => {
    if (!myPos) return;
    void load(myPos.lat, myPos.lng);
  }, [myPos, mode, radius]);

  async function load(lat: number, lng: number) {
    setLoading(true);
    const sb  = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }

    const pad = (radius / 111) * 1.3;
    const plotItems:    NearbyItem[] = [];
    const addressItems: NearbyItem[] = [];

    // ── Source: PLOT ──────────────────────────────────────────────────────────
    if (mode === 'plot' || mode === 'both') {
      const { data: plots } = await sb
        .from('plots')
        .select('id,name,lat,lng,area_rai,province,district,status,member:member_id(id,full_name,phone)')
        .not('lat', 'is', null).not('lng', 'is', null)
        .is('deleted_at', null)
        .gte('lat', lat - pad).lte('lat', lat + pad)
        .gte('lng', lng - pad * 1.5).lte('lng', lng + pad * 1.5)
        .limit(300);

      for (const p of (plots as unknown as PlotRow[]) ?? []) {
        const d = haversineM(lat, lng, p.lat, p.lng);
        if (d > radius * 1000) continue;
        plotItems.push({
          key:           p.id,
          memberId:      p.member?.id ?? p.id,
          memberName:    p.member?.full_name ?? '—',
          phone:         p.member?.phone ?? null,
          distanceM:     d,
          source:        'plot',
          plotId:        p.id,
          plotName:      p.name,
          areaRai:       p.area_rai,
          plotStatus:    p.status,
          lat:           p.lat, lng: p.lng,
          locationLabel: `แปลง: ${p.name}`,
        });
      }
    }

    // ── Source: ADDRESS (member lat/lng) ──────────────────────────────────────
    if (mode === 'address' || mode === 'both') {
      const { data: members } = await sb
        .from('members')
        .select('id,full_name,phone,lat,lng,province,district,subdistrict,address')
        .eq('status', 'approved')
        .not('lat', 'is', null).not('lng', 'is', null)
        .gte('lat', lat - pad).lte('lat', lat + pad)
        .gte('lng', lng - pad * 1.5).lte('lng', lng + pad * 1.5)
        .limit(200);

      for (const m of (members as unknown as MemberRow[]) ?? []) {
        if (!m.lat || !m.lng) continue;
        const d = haversineM(lat, lng, m.lat, m.lng);
        if (d > radius * 1000) continue;
        const locParts = [m.subdistrict, m.district, m.province].filter(Boolean);
        addressItems.push({
          key:           `member-${m.id}`,
          memberId:      m.id,
          memberName:    m.full_name,
          phone:         m.phone,
          distanceM:     d,
          source:        'address',
          plotId:        null,
          plotName:      null,
          areaRai:       null,
          plotStatus:    null,
          lat:           m.lat, lng: m.lng,
          locationLabel: locParts.length ? `ที่อยู่: ${locParts.join(' ')}` : 'ที่อยู่ทะเบียน',
        });
      }
    }

    setCounts({ plot: plotItems.length, address: addressItems.length });

    // ── Merge for 'both' — deduplicate by memberId, keep closest ─────────────
    let merged: NearbyItem[];
    if (mode === 'both') {
      // Build map: memberId → closest item (could be plot or address)
      const byMember = new Map<string, NearbyItem>();
      for (const item of [...plotItems, ...addressItems]) {
        const existing = byMember.get(item.memberId);
        if (!existing || item.distanceM < existing.distanceM) {
          // Mark source as 'both' if member appears in both
          const hasBoth = plotItems.some(p => p.memberId === item.memberId) &&
                          addressItems.some(a => a.memberId === item.memberId);
          byMember.set(item.memberId, { ...item, source: hasBoth ? 'both' : item.source });
        }
      }
      merged = Array.from(byMember.values());
    } else if (mode === 'plot') {
      merged = plotItems;
    } else {
      merged = addressItems;
    }

    merged.sort((a, b) => a.distanceM - b.distanceM);
    setItems(merged);
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

  // ── GPS error ───────────────────────────────────────────────────────────────
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
  if (loading || !myPos) return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📡</div>
      <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
        {!myPos ? 'กำลังจับพิกัด GPS…' : 'กำลังค้นหาสมาชิกใกล้ฉัน…'}
      </p>
    </div>
  );

  const shown = items.slice(0, limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Mode selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280' }}>ค้นหาตาม:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {MODE_CFG.map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setLimit(10); }}
              style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${mode === m.key ? '#2e7d32' : '#e5e7eb'}`, background: mode === m.key ? '#e8f5e9' : '#fff', color: mode === m.key ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4 }}>
              {m.label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
          {MODE_CFG.find(m => m.key === mode)?.desc}
          {mode === 'both' && counts.plot === 0 && (
            <span style={{ color: '#d97706' }}> · ยังไม่มีพิกัดแปลง</span>
          )}
          {mode === 'both' && counts.address === 0 && (
            <span style={{ color: '#d97706' }}> · สมาชิกยังไม่มีพิกัดทะเบียน</span>
          )}
        </p>
      </div>

      {/* GPS + radius */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: '#f0fdf4', color: '#166534', fontWeight: 600, flexShrink: 0 }}>
          📍 ±{Math.round(myPos.acc)}ม.
        </span>
        <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>รัศมี:</span>
        {[1, 3, 5, 10, 20].map(r => (
          <button key={r} onClick={() => { setRadius(r); setLimit(10); }}
            style={{ padding: '4px 10px', borderRadius: 99, border: `1.5px solid ${radius === r ? '#2e7d32' : '#e5e7eb'}`, background: radius === r ? '#e8f5e9' : '#fff', color: radius === r ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {r} กม.
          </button>
        ))}
      </div>

      {/* Summary */}
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
        พบ <strong style={{ color: '#111' }}>{items.length}</strong> ราย ในรัศมี {radius} กม.
        {mode === 'both' && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {' '}({counts.plot} แปลง · {counts.address} ทะเบียน)
          </span>
        )}
      </p>

      {/* Empty */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌾</div>
          <p style={{ fontSize: 13, margin: '0 0 4px' }}>ไม่พบสมาชิกในรัศมี {radius} กม.</p>
          {mode === 'plot' && (
            <p style={{ fontSize: 12, margin: 0 }}>ลองเปลี่ยนเป็น "ทั้งสอง" หรือขยายรัศมี</p>
          )}
          {mode === 'address' && (
            <p style={{ fontSize: 12, margin: 0 }}>สมาชิกอาจยังไม่มีพิกัดทะเบียน ลองเปลี่ยนเป็น "ตามแปลง"</p>
          )}
        </div>
      )}

      {/* List */}
      {shown.map(item => {
        const st  = item.plotStatus ? (STATUS_CFG[item.plotStatus] ?? STATUS_CFG.active) : null;
        const nav = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
        return (
          <div key={item.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Distance */}
              <div style={{ flexShrink: 0, width: 56, textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: DIST_COLOR(item.distanceM) }}>
                  {fmtDist(item.distanceM)}
                </div>
                {/* Source tag */}
                <div style={{ fontSize: 9, marginTop: 2, padding: '1px 4px', borderRadius: 4, background: item.source === 'plot' ? '#f0fdf4' : item.source === 'address' ? '#eff6ff' : '#faf5ff', color: item.source === 'plot' ? '#166534' : item.source === 'address' ? '#1d4ed8' : '#6d28d9', fontWeight: 700 }}>
                  {item.source === 'plot' ? 'แปลง' : item.source === 'address' ? 'ทะเบียน' : 'รวม'}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.memberName}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.plotName
                    ? `🌱 ${item.plotName} · ${item.areaRai} ไร่`
                    : `📍 ${item.locationLabel}`}
                </p>
              </div>

              {/* Status badge */}
              {st && (
                <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 700 }}>
                  {st.label}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ borderTop: '1px solid #f3f4f6', display: 'flex' }}>
              {item.phone ? (
                <a href={`tel:${item.phone}`}
                  style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', borderRight: '1px solid #f3f4f6' }}>
                  📞 โทร
                </a>
              ) : (
                <span style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 12, color: '#d1d5db' }}>ไม่มีเบอร์</span>
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
          ดูเพิ่มอีก {Math.min(10, items.length - limit)} ราย (เหลือ {items.length - limit})
        </button>
      )}
    </div>
  );
}

