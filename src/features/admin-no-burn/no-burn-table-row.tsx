'use client';

import { NoBurnEvidencePanel } from './no-burn-evidence-panel';

export type NoBurnRow = {
  id:               string;
  member_id:        string;
  status:           string;
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

export const ACTIONABLE = new Set(['submitted', 'under_review', 'inspection_required']);

type Props = {
  r:          NoBurnRow;
  acting:     string | null;
  noteDraft:  string;
  onNoteChange: (v: string) => void;
  onTransition: (id: string, status: 'under_review' | 'inspection_required' | 'approved' | 'rejected', note?: string) => void;
  showEvidence: boolean;
  onToggleEvidence: () => void;
};

export function NoBurnTableRow({ r, acting, noteDraft, onNoteChange, onTransition, showEvidence, onToggleEvidence }: Props) {
  const st       = STATUS_CFG[r.status] ?? { badge: 'pending', label: r.status, color: '#666' };
  const isActing = acting === r.id;
  const canAct   = ACTIONABLE.has(r.status) && !isActing;

  return (
    <>
      <tr>
        <td>
          <p style={{ margin: 0, fontWeight: 600 }}>{r.member?.[0]?.full_name ?? '—'}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.member?.[0]?.phone ?? ''}</p>
        </td>
        <td>{r.plots?.[0]?.name ?? '—'}{r.plots?.[0]?.area_rai ? ` (${r.plots[0].area_rai} ไร่)` : ''}</td>
        <td>{r.planting_cycles?.[0] ? `${r.planting_cycles[0].crop_name} ${r.planting_cycles[0].season_year}` : '—'}</td>
        <td style={{ textAlign: 'center' }}>{r.consent_accepted ? '✅' : '—'}</td>
        <td>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
            {st.label}
          </span>
          {r.review_note && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', maxWidth: 160 }}>💬 {r.review_note}</p>}
        </td>
        <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {new Date(r.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td>
          {/* ปุ่มดูรูปหลักฐาน */}
          <button onClick={onToggleEvidence}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: showEvidence ? '#e8f5e9' : '#f9fafb', cursor: 'pointer', marginBottom: canAct ? 6 : 0, color: showEvidence ? '#2e7d32' : '#374151' }}>
            📸 {showEvidence ? 'ซ่อนรูป' : 'ดูรูป GPS'}
          </button>

          {canAct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea rows={2} placeholder="หมายเหตุ (ไม่บังคับ)" value={noteDraft} onChange={(e) => onNoteChange(e.target.value)}
                style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px', resize: 'vertical', minHeight: 40 }} />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {r.status === 'submitted' && (
                  <button className="admin-btn" style={{ background: '#1565c0', color: '#fff', fontSize: 12 }}
                    onClick={() => onTransition(r.id, 'under_review', noteDraft)} disabled={isActing}>
                    🔍 ตรวจสอบ
                  </button>
                )}
                {(r.status === 'submitted' || r.status === 'under_review') && (
                  <button className="admin-btn" style={{ background: '#6a1b9a', color: '#fff', fontSize: 12 }}
                    onClick={() => onTransition(r.id, 'inspection_required', noteDraft)} disabled={isActing}>
                    📋 ส่งตรวจ
                  </button>
                )}
                <button className="admin-btn admin-btn--success" style={{ fontSize: 12 }}
                  onClick={() => onTransition(r.id, 'approved', noteDraft)} disabled={isActing}>✅ อนุมัติ</button>
                <button className="admin-btn admin-btn--danger" style={{ fontSize: 12 }}
                  onClick={() => onTransition(r.id, 'rejected', noteDraft)} disabled={isActing}>⛔ ปฏิเสธ</button>
              </div>
            </div>
          )}
          {isActing && <span style={{ fontSize: 12, color: '#9ca3af' }}>กำลังอัปเดต…</span>}
        </td>
      </tr>

      {/* แถวหลักฐาน GPS — แสดงเมื่อกดปุ่ม */}
      {showEvidence && (
        <tr>
          <td colSpan={7} style={{ background: '#f8fafc', padding: '8px 16px 12px', borderTop: '1px solid #f0f0f0' }}>
            <NoBurnEvidencePanel requestId={r.id} />
          </td>
        </tr>
      )}
    </>
  );
}
