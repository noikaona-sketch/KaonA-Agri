'use client';

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:   { label: '⏳ รอยืนยัน',  color: '#e65100' },
  confirmed: { label: '✅ ยืนยันแล้ว', color: '#2e7d32' },
  completed: { label: '🏁 เสร็จสิ้น',  color: '#1b5e20' },
  cancelled: { label: '⛔ ยกเลิก',     color: '#9e9e9e' },
};

const DRYING_TH: Record<string, string> = {
  required:     '🔥 ต้องอบ',
  optional:     '🌤️ อาจอบ',
  not_required: '✅ ไม่ต้องอบ',
  unknown:      '—',
};

const DELIVERY_TH: Record<string, string> = {
  fresh:     '🌽 ส่งสด',
  field_dry: '☀️ ผึ่งแห้งเอง',
  unknown:   '—',
};

// ─────────────────────────────────────────────────────────────────────────────
// QueueRow — includes new #253 admin planning fields
// ─────────────────────────────────────────────────────────────────────────────
const INPUT_STYLE = {
  display: 'block' as const, width: '100%', fontSize: 12,
  borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px',
} as const;

export type QueueRow = {
  id:                     string;
  scheduled_date:         string;
  status:                 string;
  actual_yield_kg:        number | null;
  drying_preference:      string | null;
  delivery_type:          string | null;
  estimated_moisture_pct: number | null;
  note:                   string | null;     // farmer's note
  member_name:            string;
  member_phone:           string | null;
  plot_name:              string;
  plot_province:          string | null;
  crop_name:              string;
  area_planted_rai:       number | null;
  // #253 admin planning fields
  planned_delivery_date:  string | null;
  assigned_dryer:         string | null;
  admin_note:             string | null;
  priority_score:         number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// EditDraft — mutable planning state per row
// ─────────────────────────────────────────────────────────────────────────────
export type EditDraft = {
  planned_delivery_date: string;
  assigned_dryer:        string;
  admin_note:            string;
  priority_score:        string;
};

type RowProps = {
  r:           QueueRow;
  acting:      string | null;
  draft:       EditDraft;
  onDraft:     (d: Partial<EditDraft>) => void;
  onSavePlan:  () => void;
  onConfirm:   () => void;
  onComplete:  () => void;
};

export function HarvestQueueRow({
  r, acting, draft, onDraft, onSavePlan, onConfirm, onComplete,
}: RowProps) {
  const st    = STATUS_CFG[r.status] ?? { label: r.status, color: '#666' };
  const isAct = acting === r.id;
  const canAct = (r.status === 'pending' || r.status === 'confirmed') && !isAct;

  return (
    <tr>
      {/* Member / plot */}
      <td>
        <p style={{ margin: 0, fontWeight: 600 }}>{r.member_name}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.member_phone ?? ''}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
          {r.plot_name}{r.plot_province ? ` (${r.plot_province})` : ''}
        </p>
        {r.note && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af',
            fontStyle: 'italic', maxWidth: 160, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            💬 {r.note}
          </p>
        )}
      </td>

      {/* Crop / rai */}
      <td style={{ fontSize: 13 }}>
        {r.crop_name}
        {r.area_planted_rai && (
          <span style={{ color: '#6b7280', fontSize: 12 }}> {r.area_planted_rai} ไร่</span>
        )}
      </td>

      {/* Scheduled date (farmer estimate) */}
      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
        {new Date(r.scheduled_date).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </td>

      {/* Estimated yield */}
      <td style={{ fontSize: 13, fontWeight: r.actual_yield_kg ? 700 : 400 }}>
        {r.actual_yield_kg
          ? `${r.actual_yield_kg.toLocaleString()} กก.`
          : <span style={{ color: '#9ca3af' }}>—</span>}
      </td>

      {/* Drying / delivery */}
      <td style={{ fontSize: 12 }}>
        <p style={{ margin: 0 }}>{DRYING_TH[r.drying_preference ?? 'unknown']}</p>
        <p style={{ margin: '2px 0 0', color: '#6b7280' }}>
          {DELIVERY_TH[r.delivery_type ?? 'unknown']}
        </p>
      </td>

      {/* Moisture estimate */}
      <td style={{ fontSize: 13 }}>
        {r.estimated_moisture_pct != null
          ? `${r.estimated_moisture_pct}%`
          : <span style={{ color: '#9ca3af' }}>—</span>}
      </td>

      {/* Status badge */}
      <td>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
          background: st.color + '22', color: st.color, whiteSpace: 'nowrap',
        }}>
          {st.label}
        </span>
      </td>

      {/* ── Admin planning fields (inline edit) ── */}
      <td style={{ minWidth: 200 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          <label style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>วันส่งที่วางแผน
            <input type="date" value={draft.planned_delivery_date} disabled={isAct}
              onChange={(e) => onDraft({ planned_delivery_date: e.target.value })} style={INPUT_STYLE} />
          </label>

          <label style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>เครื่องอบที่กำหนด
            <input type="text" value={draft.assigned_dryer} placeholder="เช่น เครื่องอบ 2"
              disabled={isAct} onChange={(e) => onDraft({ assigned_dryer: e.target.value })} style={INPUT_STYLE} />
          </label>

          <label style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>หมายเหตุผู้ดูแล
            <textarea rows={2} value={draft.admin_note} placeholder="หมายเหตุภายใน"
              disabled={isAct} onChange={(e) => onDraft({ admin_note: e.target.value })}
              style={{ ...INPUT_STYLE, resize: 'vertical' as const }} />
          </label>

          <label style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>คะแนนความสำคัญ
            <input type="number" value={draft.priority_score} placeholder="—" min="0"
              disabled={isAct} onChange={(e) => onDraft({ priority_score: e.target.value })} style={INPUT_STYLE} />
          </label>

          {/* Save planning fields */}
          {canAct && (
            <button className="admin-btn admin-btn--secondary"
              style={{ fontSize: 12 }} disabled={isAct} onClick={onSavePlan}>
              💾 บันทึกแผน
            </button>
          )}

          {/* Status transition buttons */}
          {canAct && (
            <div style={{ display: 'flex', gap: 4 }}>
              {r.status === 'pending' && (
                <button className="admin-btn admin-btn--success"
                  style={{ fontSize: 12 }} disabled={isAct} onClick={onConfirm}>
                  ✅ ยืนยัน
                </button>
              )}
              {r.status === 'confirmed' && (
                <button className="admin-btn admin-btn--primary"
                  style={{ fontSize: 12 }} disabled={isAct} onClick={onComplete}>
                  🏁 เสร็จสิ้น
                </button>
              )}
            </div>
          )}
          {isAct && <span style={{ fontSize: 12, color: '#9ca3af' }}>กำลังอัปเดต…</span>}
        </div>
      </td>
    </tr>
  );
}
