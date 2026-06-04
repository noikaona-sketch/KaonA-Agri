'use client';

import { useRef, useState } from 'react';
import { useRouter }        from 'next/navigation';

import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { getAuthHeaders }            from '@/lib/auth/get-auth-headers';
import { MobileAppShell }            from '@/shared/components/mobile-app-shell';
import { UIButton }                  from '@/shared/components/ui-button';
import { ErrorState }                from '@/shared/components/error-state';
import { LoadingState }              from '@/shared/components/loading-state';

const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนดที่ดิน (นส.4)' },
  { value: 'ns3k',       label: 'นส.3ก' },
  { value: 'ns3',        label: 'นส.3' },
  { value: 'sk1',        label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },
  { value: 'other',      label: 'เอกสารอื่น' },
];

// ── Nominatim reverse geocode ─────────────────────────────────────────────────
type GeoResult = {
  province: string; district: string; subdistrict: string; village: string;
  lat: number; lng: number; accuracy: number | null;
};

async function reverseGeocode(lat: number, lng: number, accuracy: number | null): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'KaonA-Agri/1.0' } });
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = (await res.json()) as { address?: Record<string, string> };
  const a = data.address ?? {};

  // Nominatim Thai address fields
  const province    = a.state          ?? a.province      ?? '';
  const district    = a.county         ?? a.city_district ?? a.district ?? '';
  const subdistrict = a.suburb         ?? a.subdistrict   ?? a.quarter  ?? '';
  const village     = a.village        ?? a.hamlet        ?? a.neighbourhood ?? a.road ?? '';

  return { province, district, subdistrict, village, lat, lng, accuracy };
}

// ── Read EXIF GPS from image file ─────────────────────────────────────────────
// Pure JS — no library needed. EXIF is in JPEG only.
function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const view = new DataView(buf);

        // Check JPEG SOI
        if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }

        let offset = 2;
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset);
          const len    = view.getUint16(offset + 2);
          if (marker === 0xFFE1) {
            // APP1 — check for Exif header
            const header = String.fromCharCode(
              view.getUint8(offset + 4), view.getUint8(offset + 5),
              view.getUint8(offset + 6), view.getUint8(offset + 7),
            );
            if (header === 'Exif') {
              const tiffStart = offset + 10;
              const isLE = view.getUint16(tiffStart) === 0x4949;
              const read16 = (o: number) => isLE ? view.getUint16(tiffStart + o, true) : view.getUint16(tiffStart + o);
              const read32 = (o: number) => isLE ? view.getUint32(tiffStart + o, true) : view.getUint32(tiffStart + o);

              // IFD0
              const ifd0Off = read32(4);
              const entries = read16(ifd0Off);
              let gpsIfdOff = 0;
              for (let i = 0; i < entries; i++) {
                const tag = read16(ifd0Off + 2 + i * 12);
                if (tag === 0x8825) { gpsIfdOff = read32(ifd0Off + 2 + i * 12 + 8); break; }
              }
              if (!gpsIfdOff) { resolve(null); return; }

              // GPS IFD
              const gpsEntries = read16(gpsIfdOff);
              let latRef = '', lngRef = '';
              let latRat: number[] = [], lngRat: number[] = [];

              for (let i = 0; i < gpsEntries; i++) {
                const base = gpsIfdOff + 2 + i * 12;
                const tag  = read16(base);
                const type = read16(base + 2);
                const cnt  = read32(base + 4);
                const valOff = base + 8;

                if (tag === 0x0001) {
                  latRef = String.fromCharCode(view.getUint8(tiffStart + read32(valOff)));
                } else if (tag === 0x0003) {
                  lngRef = String.fromCharCode(view.getUint8(tiffStart + read32(valOff)));
                } else if ((tag === 0x0002 || tag === 0x0004) && type === 5) {
                  const dataOff = read32(valOff);
                  const rats: number[] = [];
                  for (let j = 0; j < cnt; j++) {
                    const num = read32(dataOff + j * 8);
                    const den = read32(dataOff + j * 8 + 4);
                    rats.push(den ? num / den : 0);
                  }
                  if (tag === 0x0002) latRat = rats; else lngRat = rats;
                }
              }

              if (latRat.length >= 3 && lngRat.length >= 3) {
                let lat = latRat[0] + latRat[1] / 60 + latRat[2] / 3600;
                let lng = lngRat[0] + lngRat[1] / 60 + lngRat[2] / 3600;
                if (latRef === 'S') lat = -lat;
                if (lngRef === 'W') lng = -lng;
                if (lat !== 0 || lng !== 0) { resolve({ lat, lng }); return; }
              }
            }
          }
          offset += 2 + len;
        }
        resolve(null);
      } catch { resolve(null); }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 65536)); // First 64KB is enough for EXIF
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AddPlotPage() {
  const router     = useRouter();
  const { status } = useAuth();
  const member     = useCurrentMember();
  const photoInput = useRef<HTMLInputElement>(null);

  const [name,        setName]        = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [province,    setProvince]    = useState('อุบลราชธานี');  // pre-fill
  const [district,    setDistrict]    = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [village,     setVillage]     = useState('');
  const [landDocType, setLandDocType] = useState('');
  const [landDocNum,  setLandDocNum]  = useState('');

  const [lat,         setLat]         = useState<number | null>(null);
  const [lng,         setLng]         = useState<number | null>(null);
  const [accuracy,    setAccuracy]    = useState<number | null>(null);
  const [gpsLabel,    setGpsLabel]    = useState<string | null>(null);

  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;

  // ── Fill address from geocode result ───────────────────────────────────────
  function applyGeo(geo: GeoResult) {
    setLat(geo.lat);
    setLng(geo.lng);
    setAccuracy(geo.accuracy);
    if (geo.province)    setProvince(geo.province);
    if (geo.district)    setDistrict(geo.district);
    if (geo.subdistrict) setSubdistrict(geo.subdistrict);
    if (geo.village)     setVillage(geo.village);
    setGpsLabel(`${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}${geo.accuracy ? ` (±${Math.round(geo.accuracy)}ม.)` : ''}`);
  }

  // ── GPS from device ─────────────────────────────────────────────────────────
  async function captureGps() {
    setGpsLoading(true); setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
      );
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      applyGeo(geo);
    } catch (e) {
      setError(`GPS ไม่สำเร็จ: ${e instanceof GeolocationPositionError ? e.message : String(e)}`);
    }
    setGpsLoading(false);
  }

  // ── GPS from photo EXIF ─────────────────────────────────────────────────────
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpsLoading(true); setError(null);
    try {
      const coords = await readExifGps(file);
      if (!coords) {
        setError('ไม่พบข้อมูล GPS ใน EXIF ของรูปนี้ — ลองรูปที่ถ่ายในแปลง หรือจับพิกัดด้วยตัวเอง');
        setGpsLoading(false); return;
      }
      const geo = await reverseGeocode(coords.lat, coords.lng, null);
      applyGeo(geo);
    } catch (err) {
      setError(`อ่าน EXIF ไม่สำเร็จ: ${String(err)}`);
    }
    setGpsLoading(false);
    // reset input so same file can be re-selected
    if (photoInput.current) photoInput.current.value = '';
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!member?.member_id) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!name.trim() || !areaRai) { setError('กรุณากรอกชื่อแปลงและพื้นที่ให้ครบ'); return; }
    setSubmitting(true); setError(null);

    const { headers, url } = await getAuthHeaders(member, '/api/member/plot-registration');

    const form = new FormData();
    form.append('name',     name.trim());
    form.append('area_rai', areaRai);
    if (lat !== null)    form.append('lat',          String(lat));
    if (lng !== null)    form.append('lng',          String(lng));
    if (accuracy !== null) form.append('accuracy',   String(accuracy));
    if (province)        form.append('province',     province);
    if (district)        form.append('district',     district);
    if (subdistrict)     form.append('subdistrict',  subdistrict);
    if (village)         form.append('village',      village);
    if (landDocType)     form.append('land_doc_type',   landDocType);
    if (landDocNum)      form.append('land_doc_number', landDocNum);

    const res  = await fetch(url, { method: 'POST', headers, body: form });
    const data = (await res.json()) as { ok?: boolean; plot_id?: string; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? 'บันทึกไม่สำเร็จ'); return; }
    router.replace('/plots');
  }

  return (
    <MobileAppShell title="เพิ่มแปลงใหม่" subtitle="ลงทะเบียนแปลงเกษตรของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        {/* ชื่อ + พื้นที่ */}
        <label className="reg-label">ชื่อแปลง <span className="reg-required">*</span>
          <input className="reg-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น แปลงนาหมู่บ้าน" />
        </label>
        <label className="reg-label">พื้นที่ (ไร่) <span className="reg-required">*</span>
          <input className="reg-input" type="number" inputMode="decimal" min="0" step="0.25"
            value={areaRai} onChange={(e) => setAreaRai(e.target.value)} placeholder="0.00" />
        </label>

        {/* GPS Section */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#166534' }}>
            📍 พิกัด GPS
          </p>

          {gpsLabel && (
            <div style={{ background: '#dcfce7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#166534', fontWeight: 600 }}>
              ✅ {gpsLabel}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UIButton
              variant="secondary"
              fullWidth
              onClick={captureGps}
              loading={gpsLoading}
              disabled={gpsLoading}
            >
              📡 จับพิกัด GPS
            </UIButton>

            <UIButton
              variant="secondary"
              fullWidth
              onClick={() => photoInput.current?.click()}
              disabled={gpsLoading}
            >
              🖼️ จาก EXIF รูปภาพ
            </UIButton>
          </div>

          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/jpg"
            style={{ display: 'none' }}
            onChange={handlePhoto}
          />

          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#4ade80', textAlign: 'center' }}>
            จาก EXIF: เลือกรูปที่ถ่ายในแปลง (JPEG เท่านั้น)
          </p>
        </div>

        {/* ที่อยู่ — auto-fill จาก GPS หรือพิมพ์เอง */}
        <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '4px 0 0' }}>
          📮 ที่อยู่แปลง
          <span style={{ fontWeight: 400, fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
            (auto-fill จาก GPS หรือพิมพ์เอง)
          </span>
        </p>

        <label className="reg-label">จังหวัด
          <input className="reg-input" value={province} onChange={(e) => setProvince(e.target.value)}
            placeholder="อุบลราชธานี" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">อำเภอ
            <input className="reg-input" value={district} onChange={(e) => setDistrict(e.target.value)}
              placeholder="อำเภอ" />
          </label>
          <label className="reg-label">ตำบล
            <input className="reg-input" value={subdistrict} onChange={(e) => setSubdistrict(e.target.value)}
              placeholder="ตำบล" />
          </label>
        </div>

        <label className="reg-label">หมู่บ้าน
          <input className="reg-input" value={village} onChange={(e) => setVillage(e.target.value)}
            placeholder="บ้าน..." />
        </label>

        {/* เอกสารสิทธิ์ */}
        <label className="reg-label">ประเภทเอกสารสิทธิ์
          <select className="reg-input" value={landDocType} onChange={(e) => setLandDocType(e.target.value)}>
            <option value="">ไม่มี / ไม่ระบุ</option>
            {LAND_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        {landDocType && (
          <label className="reg-label">เลขที่เอกสาร
            <input className="reg-input" value={landDocNum} onChange={(e) => setLandDocNum(e.target.value)}
              placeholder="เลขโฉนด / เลขเอกสาร" />
          </label>
        )}

        <UIButton fullWidth onClick={handleSubmit} loading={submitting}
          disabled={submitting || !name.trim() || !areaRai || !member?.member_id}>
          ✅ บันทึกแปลง
        </UIButton>
        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>← ยกเลิก</UIButton>
      </div>
    </MobileAppShell>
  );
}
