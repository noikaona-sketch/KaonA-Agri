'use client';

export type DryingPref   = 'required' | 'optional' | 'not_required' | 'unknown';
export type DeliveryType = 'fresh' | 'field_dry' | 'unknown';

export const DRYING_OPTIONS: { value: DryingPref; label: string; hint: string }[] = [
  { value: 'required',     label: '🔥 ต้องอบ',          hint: 'ความชื้นสูง ต้องผ่านเครื่องอบ' },
  { value: 'optional',     label: '🌤️ อาจอบ',           hint: 'ขึ้นกับสภาพอากาศวันเก็บ' },
  { value: 'not_required', label: '✅ ไม่ต้องอบ',       hint: 'ผึ่งแห้งเองหรือส่งสด' },
  { value: 'unknown',      label: '❓ ยังไม่ตัดสินใจ',  hint: '' },
];

export const DELIVERY_OPTIONS: { value: DeliveryType; label: string; hint: string }[] = [
  { value: 'fresh',     label: '🌽 ส่งสด',        hint: 'ส่งโดยตรงหลังเก็บ ยังไม่ผ่านการอบ' },
  { value: 'field_dry', label: '☀️ ผึ่งแห้งเอง',  hint: 'ผึ่งแห้งในแปลง/ลาน ก่อนส่ง' },
  { value: 'unknown',   label: '❓ ยังไม่แน่ใจ',   hint: '' },
];

type DrySelectorProps = {
  value: DryingPref;
  onChange: (v: DryingPref) => void;
  disabled?: boolean;
};

export function DryingSelector({ value, onChange, disabled }: DrySelectorProps) {
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>ความต้องการการอบ</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {DRYING_OPTIONS.map((opt) => (
          <button key={opt.value} type="button" disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '10px 8px', borderRadius: 10, border: '2px solid',
              borderColor: value === opt.value ? '#e65100' : '#e5e7eb',
              background:  value === opt.value ? '#fff3e0' : '#fff',
              cursor: 'pointer', textAlign: 'left',
            }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13,
              color: value === opt.value ? '#e65100' : 'var(--text-secondary)' }}>
              {opt.label}
            </p>
            {opt.hint && <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>{opt.hint}</p>}
          </button>
        ))}
      </div>
    </>
  );
}

type DeliverySelectorProps = {
  value: DeliveryType;
  onChange: (v: DeliveryType) => void;
  disabled?: boolean;
};

export function DeliverySelector({ value, onChange, disabled }: DeliverySelectorProps) {
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>วิธีส่งผลผลิต</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {DELIVERY_OPTIONS.map((opt) => (
          <button key={opt.value} type="button" disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '10px 6px', borderRadius: 10, border: '2px solid',
              borderColor: value === opt.value ? '#1565c0' : '#e5e7eb',
              background:  value === opt.value ? '#e3f2fd' : '#fff',
              cursor: 'pointer', textAlign: 'center',
            }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 12,
              color: value === opt.value ? '#1565c0' : 'var(--text-secondary)' }}>
              {opt.label}
            </p>
            {opt.hint && <p style={{ margin: 0, fontSize: 9, color: '#9ca3af' }}>{opt.hint}</p>}
          </button>
        ))}
      </div>
    </>
  );
}
