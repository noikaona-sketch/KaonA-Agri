'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type NoBurnRow = {
  id:           string;
  member_id:    string;
  status:       string;
  submitted_at: string;
  review_note:  string | null;
  consent_accepted: boolean | null;
  member:         { full_name: string; phone: string | null }[] | null;
  plots:           { name: string; area_rai: number }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};

// All statuses from chk_no_burn_requests_status constraint (#132 / #153)
const STATUS_CFG: Record<string, { badge: string; label: string; color: string }> = {
  submitted:           { badge: 'pending',  label: '⏳ รอตรวจสอบ',           color: '#e65100' },
  under_review:        { badge: 'pending',  label: '🔍 กำลังตรวจสอบ',         color: '#1565c0' },
  inspection_required: { badge: 'pending',  label: '📋 ต้องตรวจแปลง',         color: '#6a1b9a' },
  approved:            { badge: 'approved', label: '✅ อนุมัติ',               color: '#2e7d32' },
  rejected:            { badge: 'rejected', label: '⛔ ไม่อนุมัติ',            color: '#9e9e9e' },
  completed:           { badge: 'approved', label: '🏁 เสร็จสิ้น',             color: '#1b5e20' },
  anomaly:             { badge: 'pending',  label: '⚠️ พบเหตุผิดปกติ',         color: '#b45309' },
  seeking_support:     { badge: 'pending',  label: '🤝 ขอคำแนะนำ',            color: '#0369a1' },
};

// Statuses where staff can still act
const ACTIONABLE = new Set(['submitted', 'under_review', 'inspection_required']);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function AdminNoBurnList() {
  const [rows,         setRows]         = useState<NoBurnRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);
  const [notice,       setNotice]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Per-row review note draft (only shown for rows being acted on)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    const s = createSupabaseBrowserClient();
    let q = s
      .from('no_burn_requests')
      .select(
        'id,member_id,status,submitted_at,review_note,consent_accepted,' +
        'member:members!no_burn_requests_member_id_fkey(full_name,phone),' +
        'plots(name,area_rai),' +
        'planting_cycles(crop_name,season_year)',
      )
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows((data as unknown as NoBurnRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  // ── Transition helper ───────────────────────────────────────────────────────
  async function transition(
    id:        string,
    newStatus: 'under_review' | 'inspection_required' | 'approved' | 'rejected',
    note?:     string,
  ) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    const { error: e } = await s
      .from('no_burn_requests')
      .update({
        status:      newStatus,
        review_note: note?.trim() || null,
      })
      .eq('id', id);
    setActing(null);
    if (e) {
      setNotice(`❌ เกิดข้อผิดพลาด: ${e.message}`);
    } else {
      const labels: Record<string, string> = {
        under_review:        'อยู่ระหว่างตรวจสอบแล้ว',
        inspection_required: 'ส่งตรวจแปลงแล้ว',
        approved:            'อนุมัติแล้ว ✅',
        rejected:            'ปฏิเสธแล้ว ⛔',
      };
      setNotice(labels[newStatus] ?? 'อัปเดตสำเร็จ');
      // Clear note draft for this row
      setNoteMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
    await load();
  }

  return (
    <div>
      {/* Notice banner */}
      {notice && (
        <div style={{
          background: '#e8f5e9', border: '1px solid #a5d6a7',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          fontWeight: 600, color: '#1b5e20',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{notice}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Status filter */}
      <div className="admin-filter-bar">
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          <option value="submitted">⏳ รอตรวจสอบ</option>
          <option value="under_review">🔍 กำลังตรวจสอบ</option>
          <option value="inspection_required">📋 ต้องตรวจแปลง</option>
          <option value="approved">✅ อนุมัติ</option>
          <option value="rejected">⛔ ไม่อนุมัติ</option>
          <option value="completed">🏁 เสร็จสิ้น</option>
          <option value="anomaly">⚠️ พบเหตุผิดปกติ</option>
          <option value="seeking_support">🤝 ขอคำแนะนำ</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>แปลง / พื้นที่</th>
                <th>พืช / ฤดูกาล</th>
                <th>ยินยอม</th>
                <th>สถานะ</th>
                <th>วันที่ยื่น</th>
                <th style={{ minWidth: 260 }}>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    ไม่มีคำขอ
                  </td>
                </tr>
              )}

              {rows.map((r) => {
                const st       = STATUS_CFG[r.status] ?? { badge: 'pending', label: r.status, color: '#666' };
                const isActing = acting === r.id;
                const canAct   = ACTIONABLE.has(r.status) && !isActing;
                const noteDraft = noteMap[r.id] ?? '';

                return (
                  <tr key={r.id}>
                    {/* Member */}
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {r.member?.[0]?.full_name ?? '—'}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                        {r.member?.[0]?.phone ?? ''}
                      </p>
                    </td>

                    {/* Plot */}
                    <td>
                      {r.plots?.[0]?.name ?? '—'}
                      {r.plots?.[0]?.area_rai ? ` (${r.plots[0].area_rai} ไร่)` : ''}
                    </td>

                    {/* Crop */}
                    <td>
                      {r.planting_cycles?.[0]
                        ? `${r.planting_cycles[0].crop_name} ${r.planting_cycles[0].season_year}`
                        : '—'}
                    </td>

                    {/* Consent */}
                    <td style={{ textAlign: 'center' }}>
                      {r.consent_accepted ? '✅' : '—'}
                    </td>

                    {/* Status badge */}
                    <td>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        padding: '3px 9px', borderRadius: 999,
                        background: st.color + '22', color: st.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {st.label}
                      </span>
                      {r.review_note && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280', maxWidth: 160 }}>
                          💬 {r.review_note}
                        </p>
                      )}
                    </td>

                    {/* Submitted at */}
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(r.submitted_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td>
                      {canAct ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Review note textarea — shared for all action buttons */}
                          <textarea
                            rows={2}
                            placeholder="หมายเหตุ (ไม่บังคับ)"
                            value={noteDraft}
                            onChange={(e) =>
                              setNoteMap((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            style={{
                              width: '100%', fontSize: 12, borderRadius: 6,
                              border: '1px solid #d1d5db', padding: '4px 8px',
                              resize: 'vertical', minHeight: 40,
                            }}
                          />

                          {/* Transition buttons */}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {/* submitted → under_review */}
                            {r.status === 'submitted' && (
                              <button
                                className="admin-btn"
                                style={{ background: '#1565c0', color: '#fff', fontSize: 12 }}
                                onClick={() => transition(r.id, 'under_review', noteDraft)}
                                disabled={isActing}
                                title="เริ่มตรวจสอบ"
                              >
                                🔍 ตรวจสอบ
                              </button>
                            )}

                            {/* submitted / under_review → inspection_required */}
                            {(r.status === 'submitted' || r.status === 'under_review') && (
                              <button
                                className="admin-btn"
                                style={{ background: '#6a1b9a', color: '#fff', fontSize: 12 }}
                                onClick={() => transition(r.id, 'inspection_required', noteDraft)}
                                disabled={isActing}
                                title="ส่งให้ตรวจแปลง"
                              >
                                📋 ส่งตรวจ
                              </button>
                            )}

                            {/* any actionable → approved */}
                            <button
                              className="admin-btn admin-btn--success"
                              style={{ fontSize: 12 }}
                              onClick={() => transition(r.id, 'approved', noteDraft)}
                              disabled={isActing}
                              title="อนุมัติ"
                            >
                              ✅ อนุมัติ
                            </button>

                            {/* any actionable → rejected */}
                            <button
                              className="admin-btn admin-btn--danger"
                              style={{ fontSize: 12 }}
                              onClick={() => transition(r.id, 'rejected', noteDraft)}
                              disabled={isActing}
                              title="ปฏิเสธ"
                            >
                              ⛔ ปฏิเสธ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>
                          {isActing ? 'กำลังอัปเดต…' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
