'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton } from '@/shared/components/ui-button';

// ─── Types ────────────────────────────────────────────────────────────────────

type MapMode = 'near_me' | 'province' | 'plots';

type PlotPin = {
  id: string; name: string; lat: number; lng: number;
  area_rai: number | null; province?: string | null;
  members: { id: string; full_name: string; phone: string | null } | null;
};

type VisitPurpose = {
  value: string; label: string;
};

const PURPOSES: VisitPurpose[] = [
  { value: 'follow_up',      label: '🌱 ติดตามการปลูก' },
  { value: 'no_burn_advice', label: '🌿 แนะนำไม่เผา' },
  { value: 'soil_check',     label: '🪱 ตรวจสภาพดิน' },
  { value: 'pest_advice',    label: '🐛 แนะนำศัตรูพืช' },
  { value: 'registration',   label: '📋 ลงทะเบียนสมาชิก' },
  { value: 'problem_solve',  label: '🔧 แก้ปัญหา' },
  { value: 'other',          label: '💬 อื่นๆ' },
];

const S = {
  modeBtn: (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: active ? 700 : 500,
    background: active ? '#2e7d32' : '#f3f4f6',
    color: active ? '#fff' : '#6b7280',
  }),
  input: {
    padding: '9px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, width: '100%', background: '#fff',
  } as React.CSSProperties,
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
};

// ─── Visit Form ───────────────────────────────────────────────────────────────

function VisitForm({
  memberId, memberName, plotId, onSaved, onCancel,
}: {
  memberId: string; memberName: string; plotId?: string | null;
  onSaved: () => void; onCancel: () => void;
}) {
  const [purpose,     setPurpose]     = useState('follow_up');
  const [purposeNote, setPurposeNote] = useState('');
  const [note,        setNote]        = useState('');
  const [followUp,    setFollowUp]    = useState('');
  const [photos,      setPhotos]      = useState<File[]>([]);
  const [geo,         setGeo]         = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [uploadPct,   setUploadPct]   = useState<number | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  function getGps() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsLoading(false); },
      () => { setError('ไม่สามารถดึง GPS ได้'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function submit() {
    setSaving(true); setError(null);
    try {
      const sb    = tryCreateSupabaseBrowserClient();
      const token = (await sb!.auth.getSession()).data.session?.access_token;
      const res   = await fetch('/api/field/visit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          member_id: memberId, plot_id: plotId ?? undefined,
          visit_purpose: purpose, visit_purpose_note: purposeNote || undefined,
          note: note || undefined, follow_up: followUp || undefined,
          ...(geo ? { gps_lat: geo.lat, gps_lng: geo.lng, gps_accuracy: geo.acc } : {}),
        }),
      });
      const d = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !d.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); setSaving(false); return; }

      // Upload photos
      if (photos.length > 0 && sb && d.id) {
        const { data: { user } } = await sb.auth.getUser();
        const uid = user?.id ?? 'unknown';
        for (let i = 0; i < photos.length; i++) {
          setUploadPct(Math.round((i / photos.length) * 100));
          const ext  = photos[i].name.split('.').pop() ?? 'jpg';
          const path = `${uid}/field_visit/${d.id}_${i}.${ext}`;
          await sb.storage.from('member-photos').upload(path, photos[i], { upsert: true });
          await sb.from('photos').insert({
            field_visit_log_id: d.id, member_id: memberId,
            storage_path: path, photo_type: 'field_visit',
            evidence_status: 'submitted',
            lat: geo?.lat ?? null, lng: geo?.lng ?? null,
            captured_at: new Date().toISOString(),
          });
        }
      }
      setUploadPct(null); onSaved();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>📝 บันทึกการเยี่ยม</p>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>👤 {memberName}</p>
      </div>

      {error && <p style={{ margin: 0, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626', border: '1px solid #fca5a5' }}>⚠️ {error}</p>}

      <label style={S.label}>
        วัตถุประสงค์
        <select style={S.input} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      {purpose === 'other' && (
        <label style={S.label}>
          ระบุวัตถุประสงค์
          <input style={S.input} value={purposeNote} onChange={(e) => setPurposeNote(e.target.value)} placeholder="ระบุวัตถุประสงค์…" />
        </label>
      )}

      <label style={S.label}>
        สรุปสิ่งที่พูดคุย
        <textarea style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} rows={3}
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="สภาพแปลง ปัญหาที่พบ คำแนะนำที่ให้…" />
      </label>

      <label style={S.label}>
        Follow-up ที่ต้องติดตาม
        <input style={S.input} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
          placeholder="เช่น ตรวจแปลงซ้ำอีก 2 สัปดาห์…" />
      </label>

      {/* Photos */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
          📷 รูปภาพ (สูงสุด 5 รูป)
        </p>
        <input type="file" accept="image/*" capture="environment" multiple
          onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {photos.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>
                📷 {f.name.slice(0, 15)}
                <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GPS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <UIButton variant="secondary" onClick={getGps} disabled={gpsLoading}>
          {gpsLoading ? '📡 กำลังดึง…' : geo ? '📍 GPS แล้ว' : '📍 จับ GPS'}
        </UIButton>
        {geo && <p style={{ margin: 0, fontSize: 11, color: '#059669' }}>{geo.lat.toFixed(4)}, {geo.lng.toFixed(4)} ±{Math.round(geo.acc)}ม.</p>}
      </div>

      {uploadPct !== null && (
        <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb' }}>
          <div style={{ height: '100%', width: `${uploadPct}%`, borderRadius: 2, background: '#2e7d32', transition: 'width .3s' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
        <button onClick={submit} disabled={saving}
          style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? '⏳ กำลังบันทึก…' : '✅ บันทึกการเยี่ยม'}
        </button>
      </div>
    </div>
  );
}

// ─── Map Component ────────────────────────────────────────────────────────────

declare global { interface Window { google: typeof google; initFieldMap?: () => void; } }

function MemberPinsMap({
  pins, onSelectPin,
}: {
  pins: PlotPin[];
  onSelectPin: (pin: PlotPin) => void;
}) {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapObj  = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const center = pins.length
      ? { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length }
      : { lat: 16.0, lng: 102.0 };

    mapObj.current = new window.google.maps.Map(mapRef.current, {
      center, zoom: 10,
      mapTypeId: 'hybrid',
      mapTypeControl: false, streetViewControl: false,
    });
    renderMarkers();
  }, [pins]);

  function renderMarkers() {
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];
    if (!mapObj.current || !window.google) return;
    pins.forEach((pin) => {
      const marker = new window.google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapObj.current!,
        title: pin.members?.full_name ?? pin.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: '#2e7d32', fillOpacity: 0.9,
          strokeColor: '#fff', strokeWeight: 2,
        },
      });
      const info = new window.google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:4px">
          <b>${pin.members?.full_name ?? '—'}</b><br/>
          📞 ${pin.members?.phone ?? '—'}<br/>
          🌱 ${pin.name} ${pin.area_rai ? `(${pin.area_rai} ไร่)` : ''}
        </div>`,
      });
      marker.addListener('click', () => { info.open(mapObj.current!, marker); onSelectPin(pin); });
      markers.current.push(marker);
    });
  }

  useEffect(() => {
    if (window.google?.maps) { initMap(); return; }
    window.initFieldMap = initMap;
    if (!document.getElementById('google-maps-script')) {
      const script = document.createElement('script');
      const key    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
      script.id    = 'google-maps-script';
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&callback=initFieldMap`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => { if (mapObj.current) renderMarkers(); }, [pins]);

  return <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 12, overflow: 'hidden' }} />;
}

// ─── Main: FieldMemberMap ─────────────────────────────────────────────────────

export function FieldMemberMap() {
  const [mode,       setMode]       = useState<MapMode>('plots');
  const [province,   setProvince]   = useState('');
  const [radius,     setRadius]     = useState('10');
  const [myGeo,      setMyGeo]      = useState<{ lat: number; lng: number } | null>(null);
  const [pins,       setPins]       = useState<PlotPin[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<PlotPin | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);

  async function load(overrideLat?: number, overrideLng?: number) {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (mode === 'province' && province) params.set('province', province);
    if (mode === 'near_me') {
      const lat = overrideLat ?? myGeo?.lat ?? 0;
      const lng = overrideLng ?? myGeo?.lng ?? 0;
      params.set('lat', String(lat)); params.set('lng', String(lng)); params.set('radius', radius);
    }
    const sb    = tryCreateSupabaseBrowserClient();
    const token = (await sb!.auth.getSession()).data.session?.access_token;
    const res   = await fetch(`/api/field/visit-log?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const d = await res.json() as { plots?: PlotPin[]; members?: { id: string; full_name: string; phone: string | null; plots: PlotPin[] }[] };
    const allPins: PlotPin[] = d.plots
      ? (d.plots as PlotPin[])
      : (d.members ?? []).flatMap((m) =>
          (m.plots ?? []).filter((p) => p.lat && p.lng).map((p) => ({
            ...p, members: { id: m.id, full_name: m.full_name, phone: m.phone },
          }))
        );
    setPins(allPins);
    setLoading(false);
  }

  function getMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyGeo(geo);
      void load(geo.lat, geo.lng);
    }, () => alert('ไม่สามารถดึง GPS ได้'));
  }

  useEffect(() => { void load(); }, [mode]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([
          { key: 'plots',    label: '🗺️ แปลงปลูก' },
          { key: 'province', label: '📍 ตามที่อยู่' },
          { key: 'near_me',  label: '📡 ใกล้ฉัน' },
        ] as { key: MapMode; label: string }[]).map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} style={S.modeBtn(mode === m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Filter controls */}
      {mode === 'province' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...S.input, flex: 1 }} value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="กรอกจังหวัด เช่น บุรีรัมย์" />
          <UIButton onClick={() => void load()}>ค้นหา</UIButton>
        </div>
      )}

      {mode === 'near_me' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <UIButton onClick={getMyLocation}>📡 ระบุตำแหน่งฉัน</UIButton>
          <select value={radius} onChange={(e) => setRadius(e.target.value)}
            style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
            {[5,10,20,50].map((r) => <option key={r} value={r}>{r} กม.</option>)}
          </select>
          {myGeo && <p style={{ margin: 0, fontSize: 12, color: '#059669' }}>📍 {myGeo.lat.toFixed(3)}, {myGeo.lng.toFixed(3)}</p>}
        </div>
      )}

      {/* Summary */}
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
        {loading ? 'กำลังโหลด…' : `พบ ${pins.length} แปลง — กดที่ pin บนแผนที่เพื่อบันทึกการเยี่ยม`}
      </p>

      {/* Map */}
      {!loading && <MemberPinsMap pins={pins} onSelectPin={(pin) => { setSelected(pin); setShowForm(false); }} />}

      {/* Selected member card */}
      {selected && (
        <div style={{ ...S.card, borderColor: '#86efac' }}>
          <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{selected.members?.full_name ?? '—'}</p>
              {selected.members?.phone && (
                <a href={`tel:${selected.members.phone}`} style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none' }}>
                  📞 {selected.members.phone}
                </a>
              )}
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                🌱 {selected.name} {selected.area_rai ? `· ${selected.area_rai} ไร่` : ''}
                {selected.province ? ` · ${selected.province}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <UIButton onClick={() => setShowForm(!showForm)}>
                {showForm ? '✕ ปิด' : '📝 บันทึกการเยี่ยม'}
              </UIButton>
            </div>
          </div>

          {notice && (
            <div style={{ margin: '0 14px 10px', padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#14532d', fontWeight: 600 }}>
              {notice}
            </div>
          )}

          {showForm && selected.members && (
            <VisitForm
              memberId={selected.members.id}
              memberName={selected.members.full_name}
              plotId={selected.id}
              onSaved={() => { setShowForm(false); setNotice('✅ บันทึกการเยี่ยมแล้ว'); setTimeout(() => setNotice(null), 3000); }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
