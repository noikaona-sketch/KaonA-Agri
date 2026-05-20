'use client';

import { HarvestMoisturePreview } from './harvest-moisture-preview';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestCompleteForm — P2 PR5 (revised)
//
// Modal body for recording factory-actual values on harvest completion.
// actual_received_kg + actual_moisture_pct are REQUIRED before completing.
// admin_note is optional.
// After completion booking becomes read-only — no casual editing of actuals.
// ─────────────────────────────────────────────────────────────────────────────

export type CompleteFormState = {
  receivedKg:    string;   // required — factory actual kg
  actualMoisture: string;  // required — factory measured moisture %
  adminNote:     string;   // optional — internal staff note
  learningTags:  string[]; // optional — lightweight post-harvest reason tags
};

export function isCompleteFormValid(form: CompleteFormState): boolean {
  const kg   = Number(form.receivedKg);
  const mois = Number(form.actualMoisture);
  return kg > 0 && kg <= 100000 && mois >= 8 && mois <= 45;
}

type CompletingBooking = {
  crop_name:  string;
  plot_name:  string;
  member_name: string;
  // farmer estimates (read-only context, not editable here)
  actual_yield_kg?:        number | null;
  estimated_moisture_pct?: number | null;
};

type Props = {
  completing: CompletingBooking;
  form:       CompleteFormState;
  onChange:   (patch: Partial<CompleteFormState>) => void;
};

export function HarvestCompleteForm({ completing, form, onChange }: Props) {
  const farmerEstKg   = completing.actual_yield_kg;
  const farmerEstMois = completing.estimated_moisture_pct;
  const tagOptions = [
    { value: 'rain_came_early', label: 'rain came early' },
    { value: 'harvester_unavailable', label: 'harvester unavailable' },
    { value: 'transport_delay', label: 'transport delay' },
    { value: 'high_moisture', label: 'high moisture' },
    { value: 'lower_yield_than_expected', label: 'lower yield than expected' },
    { value: 'farmer_rescheduled', label: 'farmer rescheduled' },
    { value: 'no_show', label: 'no_show' },
    { value: 'other', label: 'other' },
  ] as const;

  return (
    <>
      {/* Context header */}
      <p style={{ margin: 0, fontSize: 14, color: '#4a6741', fontWeight: 600 }}>
        {completing.crop_name} · {completing.plot_name} · {completing.member_name}
      </p>

      {/* Farmer estimates — read-only context */}
      {(farmerEstKg || farmerEstMois) && (
        <div style={{
          background: '#f3f4f6', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, color: '#6b7280',
        }}>
          📋 ประมาณการของเกษตรกร:{' '}
          {farmerEstKg ? `${farmerEstKg.toLocaleString()} กก.` : '—'}
          {farmerEstMois ? ` · ความชื้น ${farmerEstMois}%` : ''}
        </div>
      )}

      {/* Factory actual section — required fields */}
      <div style={{
        border: '1px solid #fde047', borderRadius: 10,
        padding: '12px 14px', background: '#fefce8',
      }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13, color: '#713f12' }}>
          📦 ข้อมูลจริงจากโรงงาน <span style={{ color: '#e53e3e' }}>*</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">
            น้ำหนักรับจริง (กก.) <span style={{ color: '#e53e3e' }}>*</span>
            <input className="reg-input" type="number" min="0" step="0.01"
              value={form.receivedKg} placeholder="กก. ที่ชั่งได้จริง"
              onChange={(e) => onChange({ receivedKg: e.target.value })} />
          </label>
          <label className="reg-label">
            ความชื้นจริง (%) <span style={{ color: '#e53e3e' }}>*</span>
            <input className="reg-input" type="number" min="0" max="100" step="0.1"
              value={form.actualMoisture} placeholder="% ที่วัดได้จริง"
              onChange={(e) => onChange({ actualMoisture: e.target.value })} />
          </label>
        </div>
      </div>

      {/* Admin note — optional */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#4a6741' }}>
          Post-harvest learning tags (optional)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {tagOptions.map((tag) => {
            const checked = form.learningTags.includes(tag.value);
            return (
              <label key={tag.value} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...form.learningTags, tag.value]
                      : form.learningTags.filter((v) => v !== tag.value);
                    onChange({ learningTags: next });
                  }}
                />
                {tag.label}
              </label>
            );
          })}
        </div>
      </div>
      <label className="reg-label">
        หมายเหตุผู้ดูแล (ไม่บังคับ)
        <input className="reg-input" maxLength={240} value={form.adminNote} placeholder="หมายเหตุสั้น ๆ (ไม่บังคับ)"
          onChange={(e) => onChange({ adminNote: e.target.value })} />
      </label>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompletedActualDisplay — read-only view after booking is completed
// Shown instead of form to prevent casual editing of factory actuals.
// ─────────────────────────────────────────────────────────────────────────────
type DisplayProps = {
  actualReceivedKg:   number | null;
  actualMoisturePct:  number | null;
  actualCompletedAt:  string | null;
  adminNote:          string | null;
  learningTags:       string[] | null;
  farmerEstKg?:       number | null;
  farmerEstMoisture?: number | null;
};

function VarianceTag({ estimated, actual, unit }: { estimated: number; actual: number; unit: string }) {
  const diff    = actual - estimated;
  const pct     = estimated !== 0 ? ((diff / estimated) * 100).toFixed(1) : null;
  const positive = diff >= 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, marginLeft: 6,
      color: positive ? '#2e7d32' : '#c62828',
    }}>
      {positive ? '+' : ''}{diff.toFixed(diff % 1 === 0 ? 0 : 1)} {unit}
      {pct ? ` (${positive ? '+' : ''}${pct}%)` : ''}
    </span>
  );
}

export function CompletedActualDisplay({
  actualReceivedKg, actualMoisturePct, actualCompletedAt, adminNote,
  learningTags,
  farmerEstKg, farmerEstMoisture,
}: DisplayProps) {
  const labelMap: Record<string, string> = {
    rain_came_early: 'rain came early',
    harvester_unavailable: 'harvester unavailable',
    transport_delay: 'transport delay',
    high_moisture: 'high moisture',
    lower_yield_than_expected: 'lower yield than expected',
    farmer_rescheduled: 'farmer rescheduled',
    no_show: 'no_show',
    other: 'other',
  };
  return (
    <div style={{
      background: '#f0fdf4', borderRadius: 10,
      padding: '12px 14px', border: '1px solid #86efac',
    }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: '#14532d' }}>
        ✅ ข้อมูลจริงจากโรงงาน (อ่านอย่างเดียว)
      </p>

      {/* Received kg + variance vs farmer estimate */}
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        น้ำหนักรับจริง:{' '}
        <strong>{actualReceivedKg != null ? `${actualReceivedKg.toLocaleString()} กก.` : '—'}</strong>
        {farmerEstKg && actualReceivedKg != null && (
          <VarianceTag estimated={farmerEstKg} actual={actualReceivedKg} unit="กก." />
        )}
      </p>
      {farmerEstKg && (
        <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af' }}>
          ประมาณการเกษตรกร: {farmerEstKg.toLocaleString()} กก.
        </p>
      )}

      {/* Moisture + variance */}
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>
        ความชื้นจริง:{' '}
        <strong>{actualMoisturePct != null ? `${actualMoisturePct}%` : '—'}</strong>
        {farmerEstMoisture && actualMoisturePct != null && (
          <VarianceTag estimated={farmerEstMoisture} actual={actualMoisturePct} unit="%" />
        )}
      </p>
      {farmerEstMoisture && (
        <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af' }}>
          ประมาณการเกษตรกร: {farmerEstMoisture}%
        </p>
      )}
      {learningTags && learningTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 8px' }}>
          {learningTags.map((tag) => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px',
              background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
            }}>
              🏷️ {labelMap[tag] ?? tag}
            </span>
          ))}
        </div>
      )}

      {adminNote && (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#166534' }}>💬 {adminNote}</p>
      )}
      {actualCompletedAt && (
        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
          บันทึกเมื่อ {new Date(actualCompletedAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <HarvestMoisturePreview
          farmerEstKg={farmerEstKg ?? null}
          farmerEstMoisture={farmerEstMoisture ?? null}
          actualReceivedKg={actualReceivedKg}
          actualMoisturePct={actualMoisturePct}
        />
      </div>
    </div>
  );
}
