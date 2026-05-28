'use client';

import { NoBurnEvidencePanel } from './no-burn-evidence-panel';

export type NoBurnRow = {
  id:               string;
  member_id:        string;
  status:           string;
  timing:           'before_planting' | 'after_planting' | null;
  submitted_at:     string;
  review_note:      string | null;
  consent_accepted: boolean | null;
  member:           { full_name: string; phone: string | null }[] | null;
  plots:            { name: string; area_rai: number }[] | null;
  planting_cycles:  { crop_name: string; season_year: number }[] | null;
};

export const STATUS_CFG: Record<string, { badge: string; label: string; color: string }> = {
  submitted:           { badge: 'pending',  label: '⏳ รอตรวจสอบ',     color: '#e65100' },
  under_review:        { badge: 'pending',  label: '🔍 กำลังตรวจสอบ',   color: '#1565c0' },
  inspection_required: { badge: 'pending',  label: '📋 ต้องตรวจแปลง',   color: '#6a1b9a' },
  approved:            { badge: 'approved', label: '✅ อนุมัติ',         color: '#2e7d32' },
  rejected:            { badge: 'rejected', label: '⛔ ไม่อนุมัติ',      color: '#9e9e9e' },
  completed:           { badge: 'approved', label: '🏁 เสร็จสิ้น',       color: '#1b5e20' },
  anomaly:             { badge: 'pending',  label: '⚠️ พบเหตุผิดปกติ',   color: '#b45309' },
  seeking_support:     { badge: 'pending',  label: '🤝 ขอคำแนะนำ',      color: '#0369a1' },
};

export const TIMING_CFG: Record<string, { label: string; color: string; bg: string }> = {
  before_planting: { label: '🌱 ก่อนลงแปลง',      color: '#1565c0', bg: '#e3f2fd' },
  after_planting:  { label: '🌿 หลังลงแปลงแล้ว',  color: '#2e7d32', bg: '#e8f5e9' },
};

export const ACTIONABLE = new Set(['submitted', 'under_review', 'inspection_required']);

type Props = {
  r:                NoBurnRow;
  acting:           string | null;
  noteDraft:        string;
  onNoteChange:     (v: string) => void;
  onTransition:     (id: string, status: 'under_review' | 'inspection_required' | 'approved' | 'rejected', note?: string, triggerInspection?: boolean) => void;
  showEvidence:     boolean;
  onToggleEvidence: () => void;
};

export function NoBurnTableRow({ r, acting, noteDraft, onNoteChange, onTransition, showEvidence, onToggleEvidence }: Props) {
  const st       = STATUS_CFG[r.status] ?? { badge: 'pending', label: r.status, color: '#666' };
  const timingCfg = r.timing ? TIMING_CFG[r.timing] : null;
  const isActing = acting === r.id;
  const canAct   = ACTIONABLE.has(r.status) && !isActing;

  return (
    <>
      <tr>
        <td>
          <p style={{ margin: 0, fontWeight: 600 }}>{r.member?.[0]?.full_name ?? '—'}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.member?.[0]?.phone ?? ''}</p>
        </td>
        <td>
          <p style={{ margin: 0 }}>{r.plots?.[0]?.name ?? '—'}</p>
          {r.plots?.[0]?.area_rai != null && (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.plots[0].area_rai} ไร่</p>
          )}
        </td>
        <td>
          {/* Timing badge */}
          {timingCfg ? (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 999,
              background: timingCfg.bg, color: timingCfg.color,
              marginBottom: 4,
            }}>
              {timingCfg.label}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#9e9e9e' }}>—</span>
          )}
          {r.planting_cycles?.[0] && (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              {r.planting_cycles[0].crop_name} {r.planting_cycles[0].season_year}
            </p>
          )}
        </td>
        <td>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px',
            borderRadius: 999, background: st.color + '22', color: st.color,
            whiteSpace: 'nowrap',
          }}>
            {st.label}
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
            {new Date(r.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          </p>
        </td>
        <td>
          {canAct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
              {r.status === 'submitted' && (
                <button onClick={() => onTransition(r.id, 'under_review')}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #1565c0', background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                  รับเรื่อง
                </button>
              )}
              {(r.status === 'submitted' || r.status === 'under_review') && (
                <button onClick={() => onTransition(r.id, 'inspection_required', noteDraft, true)}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #6a1b9a', background: '#f3e5f5', color: '#6a1b9a', cursor: 'pointer' }}>
                  ส่งตรวจแปลง
                </button>
              )}
              <button onClick={() => onTransition(r.id, 'approved', noteDraft)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #2e7d32', background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer' }}>
                อนุมัติ ✅
              </button>
              <button onClick={() => onTransition(r.id, 'rejected', noteDraft)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #9e9e9e', background: '#f5f5f5', color: '#666', cursor: 'pointer' }}>
                ปฏิเสธ
              </button>
              <textarea
                rows={2}
                placeholder="หมายเหตุ (ส่งพร้อมการตัดสินใจ)"
                value={noteDraft}
                onChange={(e) => onNoteChange(e.target.value)}
                style={{ fontSize: 11, padding: 4, borderRadius: 4, border: '1px solid #e0e0e0', resize: 'vertical' }}
              />
            </div>
          )}
          <button onClick={onToggleEvidence}
            style={{ marginTop: 4, fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', color: '#374151' }}>
            {showEvidence ? '🔼 ซ่อน' : '📷 หลักฐาน'}
          </button>
        </td>
      </tr>
      {showEvidence && (
        <tr>
          <td colSpan={5} style={{ padding: '0 12px 12px' }}>
            <NoBurnEvidencePanel requestId={r.id} />
          </td>
        </tr>
      )}
    </>
  );
}
