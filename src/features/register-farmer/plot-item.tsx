'use client';

import { useState } from 'react';

import { UIButton } from '@/shared/components/ui-button';

export type PlotDraft = {
  id: string;
  name: string;
  areaRai: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  landDocType: string;
  landDocNumber: string;
  province: string;
  photoFile: File | null;
  photoName: string;
};

export function newPlotDraft(): PlotDraft {
  return {
    id: crypto.randomUUID(),
    name: '', areaRai: '',
    lat: null, lng: null, accuracy: null,
    landDocType: '', landDocNumber: '',
    province: '', photoFile: null, photoName: '',
  };
}

const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนดที่ดิน (นส.4)' },
  { value: 'ns3k',       label: 'นส.3ก' },
  { value: 'ns3',        label: 'นส.3' },
  { value: 'sk1',        label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },
  { value: 'other',      label: 'เอกสารอื่น' },
];

type PlotItemProps = {
  plot: PlotDraft;
  index: number;
  onChange: (updated: PlotDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function PlotItem({ plot, index, onChange, onRemove, canRemove }: PlotItemProps) {
  const [gpsCapturing, setGpsCapturing] = useState(false);

  function set(field: keyof PlotDraft, value: string) {
    onChange({ ...plot, [field]: value });
  }

  function captureGPS() {
    if (!navigator.geolocation) return;
    setGpsCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ ...plot, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsCapturing(false);
      },
      () => setGpsCapturing(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onChange({ ...plot, photoFile: file, photoName: file?.name ?? '' });
  }

  return (
    <div className="kaona-card" style={{ borderColor: 'var(--primary)', borderWidth: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>แปลงที่ {index + 1}</p>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 20 }}>×</button>
        )}
      </div>

      <div className="mobile-stack" style={{ gap: 8 }}>
        <label className="reg-label">ชื่อแปลง <span className="reg-required">*</span>
          <input className="reg-input" value={plot.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น แปลงนาข้าวหมู่ 3" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label className="reg-label">พื้นที่ (ไร่) <span className="reg-required">*</span>
            <input className="reg-input" type="number" inputMode="decimal" min="0" step="0.01" value={plot.areaRai} onChange={(e) => set('areaRai', e.target.value)} placeholder="0.00" />
          </label>
          <label className="reg-label">จังหวัด
            <input className="reg-input" value={plot.province} onChange={(e) => set('province', e.target.value)} placeholder="เช่น บุรีรัมย์" />
          </label>
        </div>

        <label className="reg-label">ประเภทเอกสารสิทธิ์
          <select className="reg-input" value={plot.landDocType} onChange={(e) => set('landDocType', e.target.value)}>
            <option value="">ไม่มีเอกสาร / ไม่ระบุ</option>
            {LAND_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        {plot.landDocType && (
          <label className="reg-label">เลขที่เอกสาร
            <input className="reg-input" value={plot.landDocNumber} onChange={(e) => set('landDocNumber', e.target.value)} placeholder="เลขโฉนด/เอกสาร" />
          </label>
        )}

        {/* GPS */}
        <div>
          <UIButton variant="secondary" fullWidth onClick={captureGPS} loading={gpsCapturing} disabled={gpsCapturing}>
            {plot.lat ? `📍 ${plot.lat.toFixed(5)}, ${plot.lng!.toFixed(5)}` : '📍 จับพิกัด GPS'}
          </UIButton>
          {plot.accuracy && <p className="reg-hint" style={{ textAlign: 'center', marginTop: 4 }}>ความแม่นยำ ±{Math.round(plot.accuracy)} ม.</p>}
        </div>

        {/* รูปแปลง */}
        <label className="reg-label">ถ่ายรูปแปลง
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} id={`plot-photo-${plot.id}`} />
          <label htmlFor={`plot-photo-${plot.id}`} className="reg-input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: plot.photoName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            📷 {plot.photoName || 'กดเพื่อถ่ายรูปแปลง'}
          </label>
        </label>
      </div>
    </div>
  );
}
