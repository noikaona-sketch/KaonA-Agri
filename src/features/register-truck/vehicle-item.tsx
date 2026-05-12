'use client';

import { UIButton } from '@/shared/components/ui-button';

export type VehicleDraft = {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  yearBe: string;
  plateNumber: string;
  province: string;
  capacityTon: string;
  photoFile: File | null;
  photoName: string;
};

export function newVehicleDraft(): VehicleDraft {
  return {
    id: crypto.randomUUID(),
    vehicleType: '', brand: '', model: '', yearBe: '',
    plateNumber: '', province: '', capacityTon: '',
    photoFile: null, photoName: '',
  };
}

const VEHICLE_TYPES = [
  { value: 'truck_4w',  label: 'รถบรรทุก 4 ล้อ' },
  { value: 'truck_6w',  label: 'รถบรรทุก 6 ล้อ' },
  { value: 'truck_10w', label: 'รถบรรทุก 10 ล้อ' },
  { value: 'trailer',   label: 'รถพ่วง' },
  { value: 'tractor',   label: 'รถแทรกเตอร์' },
  { value: 'pickup',    label: 'รถกระบะ' },
  { value: 'other',     label: 'อื่นๆ' },
];

type VehicleItemProps = {
  vehicle: VehicleDraft;
  index: number;
  onChange: (updated: VehicleDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function VehicleItem({ vehicle, index, onChange, onRemove, canRemove }: VehicleItemProps) {
  function set(field: keyof VehicleDraft, value: string) {
    onChange({ ...vehicle, [field]: value });
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onChange({ ...vehicle, photoFile: file, photoName: file?.name ?? '' });
  }

  return (
    <div className="kaona-card" style={{ borderColor: '#f9a825', borderWidth: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#e65100' }}>🚛 รถคันที่ {index + 1}</p>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 20 }}>×</button>
        )}
      </div>

      <div className="mobile-stack" style={{ gap: 8 }}>
        <label className="reg-label">ประเภทรถ <span className="reg-required">*</span>
          <select className="reg-input" value={vehicle.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
            <option value="">เลือกประเภทรถ</option>
            {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="reg-label">ทะเบียนรถ <span className="reg-required">*</span>
          <input className="reg-input" value={vehicle.plateNumber} onChange={(e) => set('plateNumber', e.target.value.toUpperCase())} placeholder="กข 1234" style={{ textTransform: 'uppercase', letterSpacing: 2 }} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label className="reg-label">จังหวัดที่จด
            <input className="reg-input" value={vehicle.province} onChange={(e) => set('province', e.target.value)} placeholder="เช่น บุรีรัมย์" />
          </label>
          <label className="reg-label">ปี (พ.ศ.)
            <input className="reg-input" type="number" inputMode="numeric" value={vehicle.yearBe} onChange={(e) => set('yearBe', e.target.value)} placeholder="2565" />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label className="reg-label">ยี่ห้อ
            <input className="reg-input" value={vehicle.brand} onChange={(e) => set('brand', e.target.value)} placeholder="เช่น Isuzu" />
          </label>
          <label className="reg-label">รุ่น
            <input className="reg-input" value={vehicle.model} onChange={(e) => set('model', e.target.value)} placeholder="เช่น D-Max" />
          </label>
        </div>

        <label className="reg-label">ความจุ (ตัน)
          <input className="reg-input" type="number" inputMode="decimal" step="0.5" value={vehicle.capacityTon} onChange={(e) => set('capacityTon', e.target.value)} placeholder="5.0" />
        </label>

        {/* รูปรถ */}
        <label className="reg-label">ถ่ายรูปรถ
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} id={`vehicle-photo-${vehicle.id}`} />
          <label htmlFor={`vehicle-photo-${vehicle.id}`} className="reg-input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: vehicle.photoName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            📷 {vehicle.photoName || 'กดเพื่อถ่ายรูปรถ'}
          </label>
        </label>
      </div>
    </div>
  );
}
