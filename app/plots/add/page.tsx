'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';

const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนดที่ดิน (นส.4)' },
  { value: 'ns3k',       label: 'นส.3ก' },
  { value: 'ns3',        label: 'นส.3' },
  { value: 'sk1',        label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },
  { value: 'other',      label: 'เอกสารอื่น' },
];

export default function AddPlotPage() {
  const router  = useRouter();
  const member  = useCurrentMember();

  const [name,         setName]         = useState('');
  const [areaRai,      setAreaRai]      = useState('');
  const [province,     setProvince]     = useState('');
  const [landDocType,  setLandDocType]  = useState('');
  const [landDocNum,   setLandDocNum]   = useState('');
  const [lat,          setLat]          = useState<number | null>(null);
  const [lng,          setLng]          = useState<number | null>(null);
  const [accuracy,     setAccuracy]     = useState<number | null>(null);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  function captureGPS() {
    if (!navigator.geolocation) { setError('อุปกรณ์ไม่รองรับ GPS'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        setGpsLoading(false);
      },
      () => { setError('ไม่สามารถรับพิกัดได้ กรุณาเปิด GPS'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit() {
    if (!member?.member_id) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!name.trim() || !areaRai || !lat || !lng) {
      setError('กรุณากรอกชื่อแปลง พื้นที่ และจับพิกัด GPS ให้ครบ'); return;
    }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { error: err } = await s.from('plots').insert({
      member_id:       member.member_id,
      name:            name.trim(),
      area_rai:        Number(areaRai),
      province:        province || null,
      land_doc_type:   landDocType || null,
      land_doc_number: landDocNum || null,
      lat, lng, accuracy,
      status:          'pending_review',
      created_by:      member.member_id,
      role_used:       'farmer',
      timestamp:       new Date().toISOString(),
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    router.replace('/plots');
  }

  return (
    <MobileAppShell title="เพิ่มแปลงใหม่" subtitle="ลงทะเบียนแปลงเกษตรของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>

        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        <label className="reg-label">ชื่อแปลง <span className="reg-required">*</span>
          <input className="reg-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น แปลงนาหมู่บ้าน" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">พื้นที่ (ไร่) <span className="reg-required">*</span>
            <input className="reg-input" type="number" inputMode="decimal" min="0" step="0.25"
              value={areaRai} onChange={(e) => setAreaRai(e.target.value)} placeholder="0.00" />
          </label>
          <label className="reg-label">จังหวัด
            <input className="reg-input" value={province} onChange={(e) => setProvince(e.target.value)}
              placeholder="บุรีรัมย์" />
          </label>
        </div>

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

        {/* GPS */}
        <div>
          <UIButton variant="secondary" fullWidth onClick={captureGPS} loading={gpsLoading}>
            {lat ? `📍 ${lat.toFixed(5)}, ${lng!.toFixed(5)}` : '📍 จับพิกัด GPS ณ ตำแหน่งแปลง'}
          </UIButton>
          {accuracy && (
            <p className="reg-hint" style={{ textAlign: 'center', marginTop: 6 }}>
              ความแม่นยำ ±{Math.round(accuracy)} เมตร
            </p>
          )}
          {!lat && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: '6px 0 0' }}>
              ⚠️ ต้องยืนอยู่ที่แปลงจริงเพื่อจับพิกัด
            </p>
          )}
        </div>

        <UIButton fullWidth onClick={handleSubmit} loading={submitting}
          disabled={submitting || !name.trim() || !areaRai || !lat}>
          ✅ บันทึกแปลง
        </UIButton>

        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>
          ← ยกเลิก
        </UIButton>
      </div>
    </MobileAppShell>
  );
}
