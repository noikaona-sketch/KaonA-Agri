'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type ScheduleItem = {
  day:           number;
  activity:      string;
  label:         string;
  icon:          string;
  note?:         string;
  warning_days?: number;
};

const ACTIVITY_OPTIONS = [
  { value: 'plant',        label: '🌱 ปลูก' },
  { value: 'water',        label: '💧 ให้น้ำ' },
  { value: 'fertilize',    label: '🌿 ใส่ปุ๋ย' },
  { value: 'pest_check',   label: '🐛 ตรวจแมลง/โรค' },
  { value: 'growth_check', label: '📏 ตรวจการเจริญ' },
  { value: 'check',        label: '🔍 ตรวจทั่วไป' },
  { value: 'harvest',      label: '🚜 เก็บเกี่ยว' },
  { value: 'other',        label: '📝 อื่นๆ' },
];

const ACTIVITY_ICON: Record<string, string> = {
  plant: '🌱', water: '💧', fertilize: '🌿', pest_check: '🐛',
  growth_check: '📏', check: '🔍', harvest: '🚜', other: '📝',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  value:    string;        // JSON string
  onChange: (json: string) => void;
  label?:   string;
};

// ─────────────────────────────────────────────────────────────────────────────
export function CareScheduleBuilder({ value, onChange, label = 'ตารางดูแลพืช (Care Schedule)' }: Props) {
  const [mode, setMode]   = useState<'builder' | 'json'>('builder');
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  // Parse current value
  let items: ScheduleItem[] = [];
  try { items = JSON.parse(value || '[]'); } catch { /* ignore */ }

  function save(newItems: ScheduleItem[]) {
    onChange(JSON.stringify(newItems, null, 2));
    setJsonErr(null);
  }

  function addItem() {
    save([...items, { day: 0, activity: 'check', label: '', icon: '🔍' }]);
  }

  function updateItem(i: number, patch: Partial<ScheduleItem>) {
    const next = items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    if (patch.activity) next[i].icon = ACTIVITY_ICON[patch.activity] ?? '📝';
    save(next);
  }

  function removeItem(i: number) {
    save(items.filter((_, idx) => idx !== i));
  }

  function moveItem(i: number, dir: -1 | 1) {
    const next = [...items];
    const tmp  = next[i + dir];
    next[i + dir] = next[i];
    next[i]       = tmp;
    save(next);
  }

  function onJsonChange(text: string) {
    onChange(text);
    try { JSON.parse(text); setJsonErr(null); }
    catch (e) { setJsonErr((e as Error).message); }
  }

  // Sort by day for display
  const sorted = [...items].sort((a, b) => a.day - b.day);

  return (
    <div style={{ gridColumn: '1/-1' }}>
      {/* Label + mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setMode('builder')}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', background: mode === 'builder' ? '#2e7d32' : '#f9fafb', color: mode === 'builder' ? '#fff' : '#374151', fontWeight: 600 }}>
            🧩 Builder
          </button>
          <button type="button" onClick={() => setMode('json')}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', background: mode === 'json' ? '#1565c0' : '#f9fafb', color: mode === 'json' ? '#fff' : '#374151', fontWeight: 600 }}>
            {'{ }'} JSON
          </button>
        </div>
      </div>

      {mode === 'builder' ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: '#f9fafb', padding: '8px 12px', display: 'grid', gridTemplateColumns: '60px 130px 1fr 80px 60px 64px', gap: 8, fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
            <span>วัน</span><span>กิจกรรม</span><span>ชื่อ / หมายเหตุ</span><span>แจ้งล่วงหน้า</span><span>icon</span><span></span>
          </div>

          {/* Rows */}
          {sorted.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>ยังไม่มีกิจกรรม — กด "+ เพิ่ม" เพื่อเริ่ม</p>
          )}
          {items.map((item, i) => (
            <div key={i} style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: '60px 130px 1fr 80px 60px 64px', gap: 8, alignItems: 'center', borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {/* Day */}
              <input type="number" value={item.day} onChange={e => updateItem(i, { day: Number(e.target.value) })}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, width: '100%', textAlign: 'center' }} />

              {/* Activity */}
              <select value={item.activity} onChange={e => updateItem(i, { activity: e.target.value })}
                style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, width: '100%' }}>
                {ACTIVITY_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>

              {/* Label + Note */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <input value={item.label} onChange={e => updateItem(i, { label: e.target.value })}
                  placeholder="ชื่อกิจกรรม เช่น ปุ๋ยรอบ 1"
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, width: '100%' }} />
                <input value={item.note ?? ''} onChange={e => updateItem(i, { note: e.target.value || undefined })}
                  placeholder="หมายเหตุ (สูตรปุ๋ย/อัตรา)"
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #f0f0f0', fontSize: 11, width: '100%', color: '#6b7280' }} />
              </div>

              {/* Warning days */}
              <input type="number" value={item.warning_days ?? ''} onChange={e => updateItem(i, { warning_days: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="1"
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, textAlign: 'center', width: '100%' }} />

              {/* Icon */}
              <input value={item.icon} onChange={e => updateItem(i, { icon: e.target.value })}
                style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 18, textAlign: 'center', width: '100%' }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 3 }}>
                <button type="button" onClick={() => i > 0 && moveItem(i, -1)} disabled={i === 0}
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                <button type="button" onClick={() => i < items.length - 1 && moveItem(i, 1)} disabled={i === items.length - 1}
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', opacity: i === items.length - 1 ? 0.3 : 1 }}>↓</button>
                <button type="button" onClick={() => removeItem(i)}
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #ffcdd2', cursor: 'pointer', background: '#ffebee', color: '#c62828' }}>✕</button>
              </div>
            </div>
          ))}

          {/* Add row + summary */}
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb' }}>
            <button type="button" onClick={addItem}
              style={{ fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer' }}>
              + เพิ่มกิจกรรม
            </button>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {items.length} กิจกรรม
              {items.length > 0 && ` · D${Math.min(...items.map(i=>i.day))}–D${Math.max(...items.map(i=>i.day))}`}
            </span>
          </div>

          {/* Preview */}
          {sorted.length > 0 && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {sorted.map((item, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, background: '#f0fdf4', color: '#2e7d32', border: '1px solid #bbf7d0' }}>
                  {item.icon} D{item.day} {item.label || item.activity}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea value={value} onChange={e => onJsonChange(e.target.value)} rows={10}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${jsonErr ? '#e53e3e' : '#e5e7eb'}`, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
            placeholder='[{"day":0,"activity":"plant","label":"ปลูก","icon":"🌱","note":"ระยะ..."}]' />
          {jsonErr && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#e53e3e' }}>⚠️ JSON ไม่ถูกต้อง: {jsonErr}</p>}
        </div>
      )}
    </div>
  );
}
