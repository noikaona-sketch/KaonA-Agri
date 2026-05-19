'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestCompleteForm — modal body for completing a harvest booking
// Extracted from admin-harvest-list.tsx to stay within 200-line limit.
// PR5: adds actual_received_kg + actual_moisture_pct fields.
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  A: '#2e7d32', B: '#f57f17', C: '#e65100', reject: '#c62828',
};

export type CompleteFormState = {
  yieldKg:       string;
  moisture:      string;
  grade:         string;
  note:          string;
  receivedKg:    string;
  actualMoisture: string;
};

type CompletingBooking = {
  crop_name: string; plot_name: string; member_name: string;
  product_name?: string | null; seed_variety?: string | null;
  grade_a_moisture_max?: number | null; grade_b_moisture_max?: number | null;
};

type Props = {
  completing: CompletingBooking;
  form:       CompleteFormState;
  onChange:   (patch: Partial<CompleteFormState>) => void;
};

export function HarvestCompleteForm({ completing, form, onChange }: Props) {
  const aMax = completing.grade_a_moisture_max ?? 14.5;
  const bMax = completing.grade_b_moisture_max ?? 18;
  const moist = Number(form.moisture);
  const autoGrade = moist > 0
    ? moist <= aMax ? 'A' : moist <= bMax ? 'B' : moist <= 25 ? 'C' : 'Reject'
    : null;

  return (
    <>
      <p style={{ margin: 0, fontSize: 14, color: '#4a6741', fontWeight: 600 }}>
        {completing.crop_name} · {completing.plot_name} · {completing.member_name}
      </p>
      {completing.product_name && (
        <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1565c0' }}>
          🔬 {completing.product_name} {completing.seed_variety ?? ''} — เกรด A ≤{aMax}% ชื้น
        </div>
      )}

      {/* Farmer estimate fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="reg-label">ผลผลิตคาด (กก.)
          <input className="reg-input" type="number"
            value={form.yieldKg} onChange={(e) => onChange({ yieldKg: e.target.value })} />
        </label>
        <label className="reg-label">ความชื้น (%)
          <input className="reg-input" type="number" step="0.1" placeholder="14.5"
            value={form.moisture} onChange={(e) => onChange({ moisture: e.target.value })} />
        </label>
      </div>

      <label className="reg-label">เกรด (คำนวณอัตโนมัติจากความชื้น)
        <select className="reg-input" value={form.grade}
          onChange={(e) => onChange({ grade: e.target.value })}>
          <option value="">คำนวณอัตโนมัติ</option>
          <option value="A">เกรด A</option>
          <option value="B">เกรด B</option>
          <option value="C">เกรด C</option>
          <option value="reject">Reject</option>
        </select>
      </label>

      {autoGrade && (
        <div style={{ background: '#f7faf7', borderRadius: 8, padding: 10, fontSize: 14 }}>
          เกรดจากความชื้น {form.moisture}%:{' '}
          <strong style={{ color: GRADE_COLOR[autoGrade.toLowerCase()] ?? '#333' }}>
            เกรด {autoGrade}
          </strong>
        </div>
      )}

      <label className="reg-label">หมายเหตุ
        <input className="reg-input" value={form.note} placeholder="หมายเหตุการเก็บเกี่ยว..."
          onChange={(e) => onChange({ note: e.target.value })} />
      </label>

      {/* PR5 — factory actual values */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 6 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
          📦 ข้อมูลจริงจากโรงงาน <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">น้ำหนักรับจริง (กก.)
            <input className="reg-input" type="number" min="0"
              value={form.receivedKg} placeholder="กก. ที่ชั่งได้จริง"
              onChange={(e) => onChange({ receivedKg: e.target.value })} />
          </label>
          <label className="reg-label">ความชื้นจริง (%)
            <input className="reg-input" type="number" min="0" max="100" step="0.1"
              value={form.actualMoisture} placeholder="% ที่วัดได้จริง"
              onChange={(e) => onChange({ actualMoisture: e.target.value })} />
          </label>
        </div>
      </div>
    </>
  );
}
